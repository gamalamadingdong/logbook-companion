#!/usr/bin/env python3
import re
import subprocess
import time
import xml.etree.ElementTree as ET

PACKAGE = 'com.readyall.logbookcompanion'
ACTIVITY = f'{PACKAGE}/.MainActivity'
REMOTE_XML = '/sdcard/m5-window.xml'
LOCAL_XML = '/tmp/m5-window.xml'


def run(*args: str, check: bool = True) -> str:
    result = subprocess.run(args, check=check, text=True, capture_output=True)
    return result.stdout


def window_nodes():
    # Trusted local output from this emulator's uiautomator, not external XML.
    run('adb', 'shell', 'uiautomator', 'dump', REMOTE_XML)
    run('adb', 'pull', REMOTE_XML, LOCAL_XML)
    return list(ET.parse(LOCAL_XML).getroot().iter('node'))


def wait_node(label: str, timeout: int = 30):
    deadline = time.time() + timeout
    while time.time() < deadline:
        for node in window_nodes():
            text = f"{node.attrib.get('text', '')} {node.attrib.get('content-desc', '')}"
            if label.lower() in text.lower():
                return node
        time.sleep(1)
    raise RuntimeError(f'timed out waiting for {label!r}')


def tap(label: str):
    node = wait_node(label)
    bounds = [int(value) for value in re.findall(r'\d+', node.attrib['bounds'])]
    run('adb', 'shell', 'input', 'tap', str((bounds[0] + bounds[2]) // 2), str((bounds[1] + bounds[3]) // 2))


def start(*args: str):
    run('adb', 'shell', 'am', 'start', '-W', *args)


run('adb', 'install', '-r', 'artifacts/app-debug.apk')
start('-n', ACTIVITY)
wait_node('Try Demo Mode')
tap('Try Demo Mode')
wait_node('Home')

start('-a', 'android.intent.action.VIEW', '-d', 'logbookcompanion://app/pm5')
wait_node('Train with PM5')
run('adb', 'shell', 'input', 'keyevent', '4')
wait_node('Home')

run('adb', 'shell', 'am', 'force-stop', PACKAGE)
start('-a', 'android.intent.action.VIEW', '-d', 'logbookcompanion://app/auth/callback?code=m5-smoke&next=%2Fpm5')
try:
    wait_node('Verifying your link', 10)
except RuntimeError:
    wait_node('Link Expired', 20)

run('adb', 'shell', 'svc', 'wifi', 'disable')
run('adb', 'shell', 'svc', 'data', 'disable')
try:
    run('adb', 'shell', 'am', 'force-stop', PACKAGE)
    start('-n', ACTIVITY)
    wait_node('Try Demo Mode')
finally:
    run('adb', 'shell', 'svc', 'wifi', 'enable', check=False)
    run('adb', 'shell', 'svc', 'data', 'enable', check=False)
print('M5 Android installed smoke passed')
