#!/usr/bin/env python3
import subprocess
import time

PACKAGE = 'com.readyall.logbookcompanion'
ACTIVITY = f'{PACKAGE}/.MainActivity'


def run(*args: str, check: bool = True) -> str:
    result = subprocess.run(args, check=check, text=True, capture_output=True)
    return result.stdout


def start(*args: str):
    output = run('adb', 'shell', 'am', 'start', '-W', *args)
    if 'Status: ok' not in output:
        raise RuntimeError(output)

def assert_resumed():
    state = run('adb', 'shell', 'dumpsys', 'activity', 'activities')
    if PACKAGE not in state:
        raise RuntimeError('LC is not the resumed activity')


def wait_log(marker: str, timeout: int = 20):
    deadline = time.time() + timeout
    while time.time() < deadline:
        if marker in run('adb', 'logcat', '-d'):
            return
        time.sleep(1)
    raise RuntimeError(f'missing log marker: {marker}')

run('adb', 'install', '-r', 'artifacts/app-debug.apk')
start('-n', ACTIVITY)
assert_resumed()

run('adb', 'logcat', '-c')
start('-a', 'android.intent.action.VIEW', '-d', 'logbookcompanion://app/pm5')
wait_log('[native-app] route /pm5')
assert_resumed()

run('adb', 'shell', 'input', 'keyevent', '4')
wait_log('[native-app] back')
assert_resumed()

run('adb', 'logcat', '-c')
run('adb', 'shell', 'am', 'force-stop', PACKAGE)
callback = 'logbookcompanion://app/auth/callback?code=m5-smoke&next=%2Fpm5'
start('-a', 'android.intent.action.VIEW', '-d', callback)
wait_log('[native-app] route /auth/callback')
assert_resumed()

run('adb', 'shell', 'svc', 'wifi', 'disable')
run('adb', 'shell', 'svc', 'data', 'disable')
try:
    run('adb', 'shell', 'am', 'force-stop', PACKAGE)
    start('-n', ACTIVITY)
    assert_resumed()
finally:
    run('adb', 'shell', 'svc', 'wifi', 'enable', check=False)
    run('adb', 'shell', 'svc', 'data', 'enable', check=False)
print('M5 Android installed smoke passed')