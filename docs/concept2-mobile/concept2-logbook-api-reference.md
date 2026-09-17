# Concept2 Logbook API — official documentation snapshot

> **Official source:** https://log.concept2.com/developers/documentation/  
> **Captured:** 2026-09-17 13:17:38 UTC  
> **Source HTML SHA-256:** `55537f3ac43e558ca2d2845f2de1b48b9011116c5c7cd34cf5e974cb0a19f25a`  
> **Authority:** This is a searchable repository snapshot for implementation and test planning. The live Concept2 documentation remains authoritative when this snapshot differs.  
> **Conversion:** Official HTML converted to Markdown; interactive “Hide/Show” labels and pilcrow controls removed. Public example secret/token values were redacted.

---

This is the documentation for the Concept2 Logbook API. To use it, you’ll need to get an API key from Concept2.

If you have any questions on the API, please contact [ranking@concept2.com](mailto:ranking@concept2.com).

## URL

If you are only reading data from the Logbook, you can develop against production. If you are writing data to the Logbook, before using the live API, you must first develop against the development server and database on <https://log-dev.concept2.com>. When ready, please contact Concept2 for approval for the live API.

**Note:** Results and users in the development database may occasionally be reset. You should not rely on data persisting there.

## Security

All requests **must** be made over HTTPS.

## HTTP Verbs

Where possible, this API uses appropriate HTTP verbs for each action.

e.g.

| Verb | Description | Example |
| --- | --- | --- |
| `GET` | Used for retrieving resources. | `GET api/users/me/results` fetches all the workouts for the authenticated user |
| `POST` | Used for creating resources. | `POST api/users/me/results` with the correct payload will create a new workout for the authenicated user |
| `PATCH` | Used for updating resources. A PATCH request may accept one or more of the attributes to update the resource. As PATCH is a relatively new HTTP verb, resource endpoints currently also accept `POST` requests. | `PATCH api/users/me/results/123` will update a specific workout |
| `DELETE` | Used for deleting resources. | `DELETE api/users/me/results/123` will delete a specific workout |

## Versioning

The current version of the API is v1. By default, this is the version of the API that will be used. In order to avoid potential issues, you are encouraged to explicitly request this version via the Accept header.

`Accept: application/vnd.c2logbook.v1+json`

## Rate Limiting

The API is not currently rate limited. This may change in the future. Abuse of the API will result in either rate limits or removal of access.

## Pagination

For requests that return more than one item (e.g. GET /users/1/results), the result set may be paginated. An additional meta element will be returned as such:

```
{
    "data": [...]
    "meta": {
        "pagination": {
            "total": 11,
            "count": 3,
            "per_page": 3,
            "current_page": 1,
            "total_pages": 4,
            "links": {
                "next": "http://log.concept2.com/api/users/1/results?number=3&page=2"
            }
        }
    }
}
```

- **total** is the number of results
- **count** is the number in the current set
- **per\_page** is the number per set
- **current\_page** is the current page/set
- **total\_pages** is the number of pages available
- **links** contains next/prev links to help in fetching more results

The default number of results returned per page is 50. If you pass number=[number] as a query string parameter you can change the number of results you get back. The maximum number of results you can return in any call is 250.

Page numbering is 1-based and omitting the ?page parameter will return the first page.

## HTTP Status Codes

All requests are returned with an HTTP Status Code. This can be used to test for errors.

For example, if you try to fetch the details of a user you do not have the rights to access, you will get a 403 Forbidden error.

```
GET /api/users/5 HTTP/1.1
Host: log.concept2.com
Content-Type: application/json
Authorization: Bearer HA3n1v...IWqq
```

will return

```
HTTP/1.1 403 Forbidden
Content-Type: application/json; charset=utf-8

{
    "message": "User does not have rights to this resource",
    "status_code": 403
}
```

In case of an error, the status code is additionally passed in the response to the request along with a more descriptive message.

HTTP Status Codes include:

| Code | Description |
| --- | --- |
| 200 | Generic OK |
| 201 | Resource created |
| 401 | Invalid access token |
| 403 | User forbidden from this endpoint |
| 404 | Endpoint not found |
| 405 | Method not allowed (e.g. trying to DELETE a user is currently not supported) |
| 409 | Duplicate result |
| 422 | Can't be processed. Generally means a well-formed request which fails validation. |
| 500 | Error on behalf of the API |
| 503 | API temporarily unavailable |

## Metadata

As well as sending across the request body, you can also set optional HTTP custom headers to help with debugging and analytics. These can be sent over with every call and are as follows:

| Header | Description | Example |
| --- | --- | --- |
| X-Client-Version | The version number of your client | 1.2.34 |
| X-PM-Version | The performance monitor number, e.g. 3, 4, 5 | 5 |
| X-Firmware-Version | The version number of the firmware running on the monitor | 707 |
| X-Device | The name of the device the client is running on | iPhone 6 |
| X-Device-OS | The operating system the device is running | iOS |
| X-Device-OS-Version | The version of the operating system the device is running | 8.3 |
| X-Erg-Model-Type | If on a RowErg, the model type the PM is configured for. Values are integers defined in OBJ\_ERGMODELTYPE\_T in the BLE specification. 0 = D/E/RowErg/Dynamic, 1 = C/B, 2 = A | 1 |
| X-Other | Additional logging or debugging information. For example, if your app can use the USB LogBook or PM memory or BLE, you can pass these for analytics. | USB |

```
GET /api/users/5 HTTP/1.1
Host: log.concept2.com
Content-Type: application/json
Authorization: Bearer HA3n1v...IWqq
X-Client-Version: 6.42
X-PM-Version: 5
X-Device: Mac
X-Device-OS: OSX
X-Device-OS-Version: 10.10
```

## Authentication

## OAuth2

The Logboook API uses [OAuth2](http://oauth.net/2) for authentication.

All developers need to register their application with Concept2 before getting started. This can be done from the [API Key portal](https://log.concept2.com/developers/keys), and as the manager of the client you will be required to log in with a Concept2 Logbook account to create and manage your client. A registered OAuth application is assigned a unique Client ID and Client Secret. The Client Secret should not be shared. If using the Authorization Grant, you’ll also need to register your redirection endpoint.

Note: If you’re just developing an app to read data for your personal use, it might be easier to generate a long-lived authorization token from the Edit Profile > Applications > Concept2 Logbook API integration.

The OAuth Grant types implemented are **Authorization Code, Refresh, Client Credentials and Password**. These grants are used as follows:

**Authorization Code:** The main grant type for most applications. Users are directed to the Logbook to authorize the application, before being returned to the application with an authorization code which can be exchanged for an access token. The user never has to provide their username/password to the application.

**Refresh:** Access tokens only last for a certain period of time. They also come with a refresh token which, when the access token has expired can be exchanged for a new access token.

**Client Credentials:** This grant type is only available for certain applications and is used for activities such as creating a user account. The method through which the client obtains the user credentials is beyond the scope of this specification. If using the password grant, the client MUST discard the credentials once an access token has been obtained.

**Password:** This grant type is only available for certain trusted applications. Rather than the user authorize the application on the Logbook, instead the application directly exchanges the user’s password and username credentials for an access token.

All applications have access to the Authorization Code and Refresh grant types.

## Scopes

Scopes let you specify exactly what type of access you need. Scopes limit access for OAuth tokens. They do not grant any additional permission beyond that which the user already has.

For the web flow using the authorization grant, requested scopes will be displayed to the user on the authorize form.

In order to prevent users rejecting authorization, you are encouraged to ask only for the permissions you currently need. You can request additional scopes by revisiting the authorization flow at a later date.

Below are a list of current scopes. Note: requesting the write version of a permission will also include the read version. You can request therefore “results:write” without also needing to request “results:read”.

To get more than one scope, they should be concatenated with a comma, e.g. to have read access to a user’s profile and their results, pass *user:read,results:read*

| Name | Description |
| --- | --- |
| user:read | Grants read access to a user's profile |
| user:write | Grants read/write access to a user's profile |
| results:read | Grants read access to a user's results |
| results:write | Grants read/write access to a user's results |

Scopes should be passed when fetching an authorization code, and getting an access token (either with an autorization code or when using a refresh token). You should pass your original scope(s) for all subsequent calls. It is possible to request fewer scopes but not to request additional scopes after the initial authorization code.

***Important***: If a scope is not passed, it currently defaults to having *user:read,results:write* as the scopes. This is for backwards compatibility with existing clients and this behaviour may change in the future. **Do not rely on passing nothing as a scope**. You may either receive fewer permissions than expected, or receive an authorization error.

### Authorization Code

#### Get Authorization Code [GET](#authentication-authorization-code-get)`/oauth/authorize?client_id={client_id}&scope={scope}&response_type={response_type}&redirect_uri={redirect_uri}`

When you want to to authenticate a user via the Authorization Code grant, you need to first send them to the Logbook’s login and authorization system.

If the user then allows your application access, they will then be redirected to the callback URL you registered with ?code={authorization\_code} appended. You can then exchange this code for an access token.

#### Example URI

GET https://log.concept2.com/oauth/authorize?client\_id=ugdsra2alx7okz94smztckk6q6vc314xdem6l6hj&scope=user:read,results:write&response\_type=code&redirect\_uri=https:/example.com/logbook

**URI Parameters**


client\_id
:   `string` (required) **Example:**ugdsra2alx7okz94smztckk6q6vc314xdem6l6hj

scope
:   `string` (required) **Example:**user:read,results:write

response\_type
:   `string` (required) **Example:**code

redirect\_uri
:   `string` (required) **Example:**https://example.com/logbook

**Response  `200`**

### Access Token

#### Fetch authorization token [POST](#authentication-access-token-post)`/oauth/access_token`

The client makes a request to the token endpoint by adding the following parameters using the “application/x-www-form-urlencoded” format with a character encoding of UTF-8 in the HTTP request entity-body.

This will return an access token which can used to verify API calls. In order to minimise the effect of tokens being intercepted, each access token is only valid for a certain period, specified by the expiry\_in time, which is the lifetime in seconds of the token.

When an access token has expired, rather than request a new token with username and password, you should use the refresh\_token to get a new one. The lifetime of the refresh token is currently one year. Set the grant\_type to refresh\_token and pass the correct refresh\_token value. When you use it, as well as a new access\_token, you will also get back a new refresh token, meaning you can use the API indefinitely without the user needing to reauthenticate. If the user does not use the client for over a year, they will need to log back in.

**Note:** If using the password grant, it is important to use the refresh token rather than storing user credentials and reauthenticating that way.

Once you have got a valid access token, you can then use it in the HTTP headers of your API calls, for example:

```
GET /api/users/me HTTP/1.1
Host: log.concept2.com
Content-Type: application/json
Authorization: Bearer TA3n1v...IWqq
```

##### Authorization Parameters

| Name | Required | Description | Example |
| --- | --- | --- | --- |
| client\_id | Yes | Obtained from Concept2 | ugdsra2alx7okz94smztckk6q6vc314xdem6l6hj |
| client\_secret | Yes | Obtained from Concept2 | <redacted-public-example> |
| grant\_type | Yes | Must be one of:  - authorization\_code - password - client\_credentials - refresh\_token | authorization\_code |
| scope | Yes | A list of comma-separated permissions. See "Scopes" above for the full list. | user:read,results:write |
| code | No | Needed when using the authorization\_code grant\_type | c6YG5nTu3c9hfQCqsABV2x607znfmPEjqisPNlZG |
| username | No | Needed when using the password grant\_type | David Hart |
| password | No | Needed when using the password grant\_type | supersecret |
| redirect\_uri | No | Needed when using the authorization\_code grant\_type. This must match the value sent in the call to oauth/authorize. | myiphoneapp://oauth/callback |
| refresh\_token | No | Needed when using the refresh grant\_type | <redacted-public-example> |

#### Example URI

POST https://log.concept2.com/oauth/access\_token

**Request  `Initial Authentication`**


##### Headers

```
Content-Type: application/x-www-form-urlencoded
```

##### Body

```
client_id=ugdsra2alx7okz94smztckk6q6vc314xdem6l6hj&client_secret=<redacted-public-example>&grant_type=authorization_code&redirect_uri=myiphoneapp://oauth/callback&code=c6YG5nTu3c9hfQCqsABV2x607znfmPEjqisPNlZG&scope=user:read
```

**Request  `Refresh Token`**


##### Headers

```
Content-Type: application/x-www-form-urlencoded
```

##### Body

```
client_id=ugdsra2alx7okz94smztckk6q6vc314xdem6l6hj&client_secret=<redacted-public-example>&&grant_type=refresh_token&refresh_token=<redacted-public-example>&scope=user:read
```

**Response  `200`**


##### Headers

```
Content-Type: application/json
```

##### Body

```
{
  "access_token": "TA3n1vrNjuQJWw0TdCDHnjSmrjIPULhTlejMIWqq",
  "token_type": "Bearer",
  "expires_in": 604800,
  "refresh_token": "jHJhFzCfOOKB8oyiayubhLAlxaMkG3ruC1E8YxaR"
}
```

**Response  `400`**


Invalid request - generally due to one or more of the request parameters is missing.

##### Headers

```
Content-Type: application/json
```

##### Body

```
{
  "error": "invalid_request",
  "error_description": "The request is missing a required parameter, includes an invalid parameter value, includes a parameter more than once, or is otherwise malformed. Check the \"client_secret\" parameter."
}
```

**Response  `401`**


Incorrect login or client credentials. The error and error description will change depending which is incorrect.

##### Headers

```
Content-Type: application/json
```

##### Body

```
{
  "error": "invalid_credentials",
  "error_description": "The user credentials were incorrect."
}
```

## Logbook Users

When dealing with logbook accounts (users, workouts) this is the main resource root.

### Users

#### Create User [POST](#logbook-users-users-post)`/api/users`

This endpoint is used for creating a new user. To do this, you need to use a ***client access token*** rather than a user access token. Following are the list of values that can be sent as part of the message body.

| Name | Required | Type | Description | Example |
| --- | --- | --- | --- | --- |
| username | Yes | string | Must be unique | Peter Parker |
| first\_name | Yes | string |  | Peter |
| last\_name | Yes | string |  | Parker |
| gender | Yes | string | Must be one of  - F - M | M |
| password | Yes | string | Must be a minimum of 6 characters long | supersecret |
| dob | Yes | date | Date of birth in YYYY-MM-DD format | 1962-08-01 |
| email | Yes | string | Must be a valid email address | peterp@concept2.com |
| country | Yes | string | Must be a valid three-letter [IOC code](http://en.wikipedia.org/wiki/List_of_IOC_country_codes). | USA |
| email\_permission | No | boolean | If Concept2 has permission to email the user about Logbook Challenges etc. | true |
| max\_heart\_rate | No | integer | The maximum heart rate for the user. Defaults to null if not set. | 180 |
| weight | No | integer | The weight in decigrams for the user, e.g. 7500 for 75kg. Defaults to null if not set. | 7500 |
| logbook\_privacy | No | string | Sets the default privacy level for workouts in the logbook. Must be one of  - private - partners - logged\_in - everyone  If not set, will default to partners. "partners" means workouts will only be visible to training partners and "logged\_in" to all logged in users. Privacy levels for individual workouts can be set separately. | partners |

##### Return Values

As well as returning the fields used when creating a user the following additional fields will be returned:

| Name | Type | Description | Example |
| --- | --- | --- | --- |
| profile\_image | string | The full URL for the profile image. By changing the URL, you can get different size images [square (cropped to 75x75), medium (maximum 320px wide), large (maximum 640px wide)] | http://media.concept2.com/assets/uploads/profiles/2/small/mypicture.jpg |
| age\_restricted | boolean | If the user is under 13, then certain details (full surname etc) are not stored unless the parents or guardian of the user has filled in a COPPA registration form. | false |

#### Example URI

POST https://log.concept2.com/api/users

**Request**


##### Headers

```
Content-Type: application/json  
Authorization: Bearer aValid...oken
```

##### Body

```
{
  "username": "Peter Parker",
  "password": "supersecret",
  "first_name": "Peter",
  "last_name": "Parker",
  "gender": "M",
  "dob": "1962-08-01",
  "email": "peterp@concept2.com",
  "country": "USA"
}
```

**Response  `201`**


##### Headers

```
Content-Type: application/json
```

##### Body

```
{
  "data": {
    "id": 1,
    "username": "David Hart",
    "first_name": "David",
    "last_name": "Hart",
    "gender": "M",
    "dob": "1977-08-19",
    "email": "davidh@concept2.com",
    "country": "GBR",
    "profile_image": "http://media.concept2.com/assets/uploads/profiles/1/small/mypicture.jpg",
    "age_restricted": false,
    "email_permission": true,
    "max_heart_rate": null,
    "logbook_privacy": "partners"
  }
}
```

**Response  `422`**


Validation error - one or more fields is missing or incorrect.

##### Headers

```
Content-Type: application/json
```

##### Body

```
{
  "message": "Could not create user.",
  "status_code": 422,
  "errors": {
    "gender": [
      "The gender field is required."
    ],
    "username": [
      "The username has already been taken."
    ]
  }
}
```

### User

#### Get User [GET](#logbook-users-user-get)`/api/users/{user}`

Get a user by id.

#### Example URI

GET https://log.concept2.com/api/users/me

**URI Parameters**


user
:   `number or string` (required) **Example:**me

    Either the integer id of the user or ‘me’ as shorthand for authenticated user.

**Request**


##### Headers

```
Content-Type: application/json  
Authorization: Bearer ***
```

**Response  `200`**


##### Headers

```
Content-Type: application/json
```

##### Body

```
{
  "data": {
    "id": 1,
    "username": "David Hart",
    "first_name": "David",
    "last_name": "Hart",
    "gender": "M",
    "dob": "1977-08-19",
    "email": "davidh@concept2.com",
    "country": "GBR",
    "profile_image": "http://media.concept2.com/assets/uploads/profiles/1/small/mypicture.jpg",
    "age_restricted": false,
    "email_permission": true,
    "max_heart_rate": null,
    "logbook_privacy": "partners"
  }
}
```

#### Edit User [PATCH](#logbook-users-user-patch)`/api/users/{user}`

Edit an existing user. You can send across either the entire resource or just any changed values.

#### Example URI

PATCH https://log.concept2.com/api/users/me

**URI Parameters**


user
:   `number or string` (required) **Example:**me

    Either the integer id of the user or ‘me’ as shorthand for authenticated user.

**Request**


##### Headers

```
Content-Type: application/json  
Authorization: Bearer ***
```

##### Body

```
{
  "email": "peterp@concept2.co.uk"
}
```

**Response  `200`**


##### Headers

```
Content-Type: application/json
```

##### Body

```
{
  "data": {
    "id": 2,
    "username": "Peter Parker",
    "first_name": "Peter",
    "last_name": "Parker",
    "gender": "M",
    "dob": "1962-08-01",
    "email": "peterp@concept2.co.uk",
    "country": "USA"
  }
}
```

**Response  `422`**


Validation error - one or more fields is incorrect.

##### Headers

```
Content-Type: application/json
```

##### Body

```
{
  "message": "Could not update user.",
  "status_code": 422,
  "errors": {
    "email": [
      "The email format is invalid."
    ]
  }
}
```

### Profile Image

#### Update Image [POST](#logbook-users-profile-image-post)`/api/users/{user}/image`

Update or add the profile image for an existing user. Images must be posted as multipart/form-data. There is a maximum limit of 2MB for the uploaded image.

The full URL for the profile image will be returned on success. By changing the URL, you can get different size images [square (cropped to 75x75), medium (maximum 320px wide), large (maximum 640px wide)]

#### Example URI

POST https://log.concept2.com/api/users/me/image

**URI Parameters**


user
:   `number or string` (required) **Example:**me

    Either the integer id of the user or ‘me’ as shorthand for authenticated user.

**Request**


##### Headers

```
Content-Type: multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW  
Authorization: Bearer ***
```

##### Body

```
----WebKitFormBoundary7MA4YWxkTrZu0gW
Content-Disposition: form-data; name="image"; filename="_DSC4503.jpg"
Content-Type: image/jpeg

(data)
----WebKitFormBoundary7MA4YWxkTrZu0gW
```

**Response  `200`**


##### Headers

```
Content-Type: application/json
```

##### Body

```
{
  "data": {
    "profile_image": "http://log.concept2.com/assets/uploads/profiles/1/small/21d29076e455877b19531d5a4cd4033a.jpg"
  }
}
```

### Results

#### Get Results [GET](#logbook-users-results-get)`/api/users/{user}/results`

Get all results for the current user. The response is paginated. See Pagination for more information on how to work with paginated result sets.

It’s possible to filter the results and return only results that match certain criteria. To do this, pass the filter criteria as query string variables.

The following filter criteria are available:

| Key | Description | Example |
| --- | --- | --- |
| from | Fetches only results where the workout date is on or after this. Should be in YYYY-MM-DD format. Note: You can also use full "YYYY-MM-DD H:M:S" if required. | 2015-05-01 |
| to | Fetches only results where the workout date is on or before this. Should be in YYYY-MM-DD format. Note: You can also use full "YYYY-MM-DD H:M:S" if required. | 2015-05-01 |
| type | Fetches only results of this type. Must be one of  - rower - skierg - bike - dynamic - slides - paddle - water - snow - rollerski - multierg | rower |
| updated\_after | Fetches only results created or updated on or after this date. Should be in YYYY-MM-DD format. Note: You can also use full "YYYY-MM-DD H:M:S" if required. The timezone of the updated\_after date is GMT, so you should convert to this when making the call. | 2015-05-01 12:54:23 |

For example, to get all rower results in May 2015, call:

```
GET /api/users/me/results?from=2015-05-01&to=2015-05-31&type=rower
```

#### Example URI

GET https://log.concept2.com/api/users/me/results

**URI Parameters**


user
:   `number or string` (required) **Example:**me

    Either the integer id of the user or ‘me’ as shorthand for authenticated user.

**Request**


##### Headers

```
Content-Type: application/json  
Authorization: Bearer ***
```

**Response  `200`**


##### Headers

```
Content-Type: application/json
```

##### Body

```
{
  "data": [
    {
      "id": 3,
      "user_id": 1,
      "date": "2013-06-21 00:00:00",
      "timezone": null,
      "date_utc": null,
      "distance": 23000,
      "type": "rower",
      "time": 152350,
      "time_formatted": "4:13:55.0",
      "workout_type": "unknown",
      "source": "Web",
      "weight_class": "H",
      "verified": false,
      "ranked": false,
      "comments": null,
      "privacy": "partners"
    },
    {
      "id": 8,
      "user_id": 1,
      "date": "2013-05-10 00:00:00",
      "timezone": null,
      "date_utc": null,
      "distance": 42195,
      "type": "skierg",
      "time": 262700,
      "time_formatted": "7:17:50.0",
      "workout_type": "unknown",
      "source": "Web",
      "weight_class": "H",
      "verified": false,
      "ranked": false,
      "comments": null,
      "privacy": "partners"
    }
  ],
  "meta": {
    "pagination": {
      "total": 9,
      "count": 9,
      "per_page": 50,
      "current_page": 1,
      "total_pages": 1,
      "links": []
    }
  }
}
```

#### Add Result [POST](#logbook-users-results-post)`/api/users/{user}/results`

Add a new workout. Following are the list of values that can be sent as part of the message body. **Note:** the Logbook filters for duplicate workouts, so will return a Duplicate Entry error if you post a workout which has the same date, time and distance as an existing workout. **Note:** We recommend you use our [Online Validator](https://log.concept2.com/developers/validator) tool to check workouts for errors, especially if uploading interval workouts.

| Name | Required | Type | Description | Example |
| --- | --- | --- | --- | --- |
| type | Yes | string | Must be one of  - rower - skierg - bike - dynamic - slides - paddle - water - snow - rollerski - multierg | rower |
| date | Yes | datetime | Either date or datetime in yyyy-mm-dd hh:mm:ss format. Note: this should be the date as stored in the monitor, which is the end of the workout, NOT the beginning. | 2015-05-01 14:32:12 |
| timezone | No | string | If present, must be a valid timezone format from the [tz database](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones). | America/New\_York |
| distance | Yes | integer | In meters. **Note:** for interval workouts this is work distance only. Rest distance is set separately (see below). | 5000 |
| time | Yes | integer | Time in tenths of a second. e.g. one minute would be 600. **Note:** for interval workouts this is work time only. Rest time is set separately (see below). | 1200 |
| weight\_class | Depends | string | Required if type is rower, dynamic or slides. Value must be either H or L | H |
| comments | No | string | No markup or formatting is curently supported apart from line breaks and paragraphs using \r and \n. | First workout of the year.\r\n\r\nDone at the gym. |
| privacy | No | string | Must be one of  - private - partners - logged\_in - everyone  If not set, will default to user's logbook\_privacy status. See user object for more information. | partners |
| workout\_type | No | string | Must be one of  - unknown - JustRow - FixedDistanceSplits - FixedTimeSplits - FixedCalorie - FixedWattMinute - FixedTimeInterval - FixedDistanceInterval - FixedCalorieInterval - FixedWattMinuteInterval - VariableInterval - VariableIntervalUndefinedRest | FixedDistanceInterval |
| stroke\_rate | No | integer | Average stroke rate for a workout | 36 |
| heart\_rate | No | object | object of strings containing the following optional values:  - average - min - max - ending - recovery | ``` "heart_rate": {     "ending": 160,     "recovery": 70 } ``` |
| stroke\_count | No | integer | Total number of strokes in a workout | 236 |
| calories\_total | No | integer | Total calories in a workout | 436 |
| wattminutes\_total | No | integer | Total watt-minutes in a workout | 878 |
| drag\_factor | No | integer | Average drag factor (to nearest whole number) | 115 |
| rest\_distance | Depends | integer | For interval workouts only. This is the total distance in meters of distance covered in rest intervals. | 335 |
| rest\_time | Depends | integer | For interval workouts only. This is the value in tenths of a second of total time spent in rest intervals. | 600 |
| verified | optional | boolean | Whether the result should be considered verified. Only trusted clients are able to verify workouts. Please contact Concept2 for more information. | false |
| verification\_code | optional | string | The verification code for the piece. For the verification code to be accepted, the date, time, distance, workout\_type and machine type must match that of the code. | 1234-5678-90AB-CDEF- |
| workout | No | array | Array of objects containing split or interval data. See below for more info. |  |
| stroke\_data | No | array | Array of objects containing stroke data. See below for more info. |  |
| metadata | No | object | Object containing meta data. See below for more info. |  |

##### Workout Details

These are the possible values for the workout field.

The following fields are possible. Note: split and interval data are validated for type and expected values. Sending across a decimal value or a string where an integer is expected (e.g. stroke\_rate or calories\_total) will result in the workout failing.

Possible values are

| Name | Required | Type |
| --- | --- | --- |
| splits | No | array |
| intervals | No | array |
| targets | No | object |

##### Split/Interval Workouts

Splits and intervals are an array of objects. Each object can contain the following fields:

| Name | Required | Type | Description | Example |
| --- | --- | --- | --- | --- |
| distance | Yes | integer | In meters. **Note:** for interval workouts this is work distance only. Rest distance is set separately (see below). | 5000 |
| time | Yes | integer | Time in tenths of a second. e.g. one minute would be 600. **Note:** for interval workouts this is work time only. Rest time is set separately where available (see below). | 1200 |
| stroke\_rate | No | integer | Average stroke rate | 34 |
| calories\_total | No | integer | Total calories | 26 |
| wattminutes\_total | No | integer | Total Watt-Minutes | 120 |
| heart\_rate | No | object | An object with integer values for one or more of the following optional fields:  - average - min - max - ending - rest - recovery | ``` "heart_rate": {     "average": 140,     "ending": 160,     "rest": 70 } ``` |

The following fields are also for **interval workouts only**.

| Name | Required | Type | Description | Example |
| --- | --- | --- | --- | --- |
| type | Yes | string | Must be one of:  - time - distance - calorie - wattminute | time |
| rest\_time | Yes | integer | This is the value in tenths of a second of the time spent in rest intervals. | 300 |
| rest\_distance | No | integer | This is the distance in meters spent in rest intervals. This should be included for Variable interval workouts only. | 50 |
| machine | No | string | Must be one of:  - skierg - rower - bike  . This should be included for MultiErg workouts only. | row |

##### Targets

Each workout can also have an optional set of targets which the athlete tried to hit during the workout. For split and fixed distance/time/calorie/wattminute intervals, these targets should at workout level (i.e. the same level as split or interval data). For variable interval workouts, the target should be at the level of each individual interval. The targets object is optional, and all keys in it are optional. Note, only one of watts, calories or pace can be present (i.e. you can not set both a target 500m pace and a target watts).

| Name | Required | Type | Description | Example |
| --- | --- | --- | --- | --- |
| stroke\_rate | No | integer | Can be between 0 and 255. The key is stroke\_rate even for BikeErgs. | 30 |
| heart\_rate\_zone | No | integer | Can be between 0 and 5. 0 would indicate a target heart rate zone is not set. | 4 |
| pace | No | integer | Time in tenths of a second | 1020 |
| watts | No | integer | Can be between 0 and 999 | 400 |
| calories | No | integer | Can be between 0 and 9999 | 1300 |

##### Strokes

Strokes are an array of objects which can contain the following fields for each stroke:

| Name | Required | Type | Description | Example |
| --- | --- | --- | --- | --- |
| t | No | integer | **Time**. In tenths of a second. e.g. 23 is 2.3 seconds. | 23 |
| d | No | integer | **Distance**. In decimeters, e.g. 155 is 15.5 meters | 155 |
| p | No | integer | **Pace**. Pace in tenths of a second, e.g. 971 is a pace of 1:37.1. This is pace per 500m for the rower and SkiErg, and pace per 1000m for the BikeErg. | 971 |
| spm | No | integer | **Strokes Per Minute**. Value as of current stroke rate. | 35 |
| hr | No | integer | **Heart Rate**. Value of current heart rate | 156 |

**Note:** Time and distance are incremental rather than the difference between the previous stroke. For interval workouts, time and distance start again at 0 for each interval.

##### Metadata

When adding results, instead of using headers to send across metadata, you can also send them across as part of the result body. This is especially useful if using the bulk results endpoint and submitting multiple results at once which may have been rowed on different machines. All values are optional. **Note:** If sending across both metadata headers and as part of the result body, the ones sent as part of the result body will be used.

| Name | Description | Example |
| --- | --- | --- |
| client\_version | The version number of your client | 1.2.34 |
| pm\_version | The performance monitor number, e.g. 3, 4, 5 | 5 |
| firmware\_version | The version number of the firmware running on the monitor | 707 |
| serial\_number | The serial number of the monitor | 430395351 |
| device | The name of the device the client is running on | iPhone 6 |
| device\_os | The operating system the device is running | iOS |
| device\_os\_version | The version of the operating system the device is running | 8.3 |
| erg\_model\_type | If on a RowErg, the model type the PM is configured for. Values are integers defined in OBJ\_ERGMODELTYPE\_T in the BLE specification. 0 = D/E/RowErg/Dynamic, 1 = C/B, 2 = A | 1 |
| hr\_type | Either BT, ANT or Apple | Apple |
| other | Additional logging or debugging information. For example, if your app can use the USB LogBook or PM memory or BLE, you can pass these for analytics. | USB |

#### Example URI

POST https://log.concept2.com/api/users/me/results

**URI Parameters**


user
:   `number or string` (required) **Example:**me

    Either the integer id of the user or ‘me’ as shorthand for authenticated user.

**Request  `Simple workout`**


##### Headers

```
Content-Type: application/json  
Authorization: Bearer ***
```

##### Body

```
{
  "type": "rower",
  "date": "2015-08-05 13:15:41",
  "timezone": "Europe/London",
  "distance": 5649,
  "time": 8649,
  "weight_class": "H",
  "workout_type": "JustRow",
  "comments": null
}
```

**Request  `Just Row workout`**


##### Headers

```
Content-Type: application/json  
Authorization: Bearer ***
```

##### Body

```
{
  "date": "2017-05-15 16:40:00",
  "timezone": "Europe/London",
  "workout_type": "JustRow",
  "type": "rower",
  "weight_class": "H",
  "time": 4861,
  "distance": 1217,
  "drag_factor": 104,
  "calories_total": 60,
  "stroke_rate": 30,
  "stroke_count": 250,
  "workout": {
    "splits": [
      {
        "distance": 741,
        "time": 3000,
        "stroke_rate": 32,
        "calories_total": 37,
        "heart_rate": {
          "ending": 140
        }
      },
      {
        "distance": 477,
        "time": 1861,
        "stroke_rate": 29,
        "calories_total": 23,
        "heart_rate": {
          "ending": 150
        }
      }
    ]
  }
}
```

**Request  `Single Time workout`**


##### Headers

```
Content-Type: application/json  
Authorization: Bearer ***
```

##### Body

```
{
  "date": "2017-05-16 17:24:00",
  "timezone": "US/Pacific",
  "workout_type": "FixedTimeSplits",

  "type": "rower",
  "weight_class": "H",
  "time": 6000,
  "distance": 1789,
  "stroke_count": 314,
  "drag_factor": 134,
  "stroke_rate": 31,
  "calories_total": 90,
  "workout": {
    "splits": [
      {
        "time": 1200,
        "calories_total": 18,
        "stroke_rate": 33,
        "distance": 354
      },
      {
        "time": 1200,
        "calories_total": 18,
        "stroke_rate": 31,
        "distance": 355
      },
      {
        "time": 1200,
        "calories_total": 18,
        "stroke_rate": 32,
        "distance": 357
      },
      {
        "time": 1200,
        "calories_total": 18,
        "stroke_rate": 31,
        "distance": 363
      },
      {
        "time": 1200,
        "calories_total": 18,
        "stroke_rate": 30,
        "distance": 361
      }
    ]
  }
}
```

**Request  `Distance Interval workout`**


##### Headers

```
Content-Type: application/json  
Authorization: Bearer ***
```

##### Body

```
{
  "date": "2015-08-30 14:24:00",
  "timezone": "Europe/London",
  "distance": 440,
  "time": 762,
  "type": "rower",
  "weight_class": "H",
  "heart_rate": {
    "average": 140
  },
  "workout_type": "FixedDistanceInterval",
  "rest_distance": 43,
  "rest_time": 1200,
  "workout": {
    "targets": {
      "stroke_rate": 30,
      "heart_rate_zone": 4,
      "pace": 1050
    },
    "intervals": [
      {
        "type": "distance",
        "time": 415,
        "rest_time": 600,
        "stroke_rate": 35,
        "distance": 220,
        "heart_rate": {
          "ending": 160,
          "rest": 60
        }
      },
      {
        "type": "distance",
        "time": 347,
        "rest_time": 600,
        "stroke_rate": 45,
        "distance": 220,
        "heart_rate": {
          "ending": 170,
          "rest": 70
        }
      }
    ]
  }
}
```

**Request  `Time Interval workout with targets`**


##### Headers

```
Content-Type: application/json  
Authorization: Bearer ***
```

##### Body

```
{
  "date": "2015-08-30 14:24:00",
  "timezone": "Europe/London",
  "distance": 440,
  "time": 762,
  "type": "rower",
  "weight_class": "H",
  "heart_rate": {
    "average": 140
  },
  "workout_type": "FixedDistanceInterval",
  "rest_distance": 43,
  "rest_time": 1200,
  "workout": {
    "targets": {
      "stroke_rate": 30,
      "heart_rate_zone": 4,
      "pace": 1050
    },
    "intervals": [
      {
        "type": "distance",
        "time": 415,
        "rest_time": 600,
        "stroke_rate": 35,
        "distance": 220,
        "heart_rate": {
          "ending": 160,
          "rest": 60
        }
      },
      {
        "type": "distance",
        "time": 347,
        "rest_time": 600,
        "stroke_rate": 45,
        "distance": 220,
        "heart_rate": {
          "ending": 170,
          "rest": 70
        }
      }
    ]
  }
}
```

**Request  `Variable Interval workout`**


##### Headers

```
Content-Type: application/json  
Authorization: Bearer ***
```

##### Body

```
{
  "date": "2017-05-01 14:33:00",
  "timezone": "Australia/Melbourne",
  "workout_type": "VariableInterval",
  "type": "rower",
  "weight_class": "H",
  "time": 16800,
  "distance": 6721,
  "rest_distance": 236,
  "rest_time": 2700,
  "calories_total": 427,
  "drag_factor": 175,
  "stroke_count": 996,
  "stroke_rate": 33,
  "workout": {
    "intervals": [
      {
        "type": "time",
        "time": 2400,
        "distance": 1011,
        "rest_time": 600,
        "rest_distance": 43,
        "stroke_rate": 35,
        "calories_total": 68
      },
      {
        "type": "time",
        "time": 3000,
        "distance": 1229,
        "rest_time": 600,
        "rest_distance": 59,
        "stroke_rate": 34,
        "calories_total": 80
      },
      {
        "type": "time",
        "time": 3000,
        "distance": 1190,
        "rest_time": 600,
        "rest_distance": 59,
        "stroke_rate": 33,
        "calories_total": 75
      },
      {
        "type": "time",
        "time": 2400,
        "distance": 971,
        "rest_time": 750,
        "rest_distance": 44,
        "stroke_rate": 34,
        "calories_total": 62
      },
      {
        "type": "time",
        "time": 6000,
        "distance": 2320,
        "rest_time": 150,
        "rest_distance": 31,
        "stroke_rate": 32,
        "calories_total": 142
      }
    ]
  }
}
```

**Response  `201`**


##### Headers

```
Content-Type: application/json
```

##### Body

```
{
  "data": {
    "id": 339,
    "user_id": 1,
    "date": "2015-08-05 13:15:41",
    "timezone": "Europe/London",
    "date_utc": "2015-08-05 12:15:41",
    "distance": 5649,
    "type": "rower",
    "time": 8649,
    "time_formatted": "14:24.9",
    "workout_type": "JustRow",
    "source": "ErgData",
    "weight_class": "H",
    "verified": true,
    "ranked": false
  }
}
```

**Response  `409`**


Duplicate result - the workout you are trying to add has the same time, distance and date as an existing workout.

##### Headers

```
Content-Type: application/json
```

##### Body

```
{
    "message": "Duplicate result",
    "status_code": 409,
}
```

**Response  `422`**


Validation error - one or more fields is missing or incorrect.

##### Headers

```
Content-Type: application/json
```

##### Body

```
{
  "message": "Could not create user.",
  "status_code": 422,
  "errors": {
    "distance": [
      "The distance field is required."
    ]
  }
}
```

### Multiple Results

#### Add Results [POST](#logbook-users-multiple-results-post)`/api/users/{user}/results/bulk`

If you want to add more than one workout at once, you can post to /api/users/me/results/bulk.

This takes an array of results. The return response will be an array of results or error messages, similar to posting individual results, but with an additional status code. The status code of the responsed will always be 200.

#### Example URI

POST https://log.concept2.com/api/users/me/results/bulk

**URI Parameters**


user
:   `number or string` (required) **Example:**me

    Either the integer id of the user or ‘me’ as shorthand for authenticated user.

**Request**


##### Headers

```
Content-Type: application/json  
Authorization: Bearer ***
```

##### Body

```
[
  {
    "type": "rower",
    "date": "2015-05-14 03:15:41",
    "distance": 5649,
    "time": 8649,
    "weight_class": "H",
    "workout_type": "JustRow"
  },
  {
    "type": "rower",
    "date": "2015-05-14 03:15:41",
    "distance": 5649,
    "time": 8649,
    "weight_class": "H",
    "workout_type": "JustRow"
  }
]
```

**Response  `200`**


##### Headers

```
Content-Type: application/json
```

##### Body

```
[
  {
    "status_code": 201,
    "data": {
      "id": 371,
      "user_id": 1,
      "date": "2015-05-05 03:15:41",
      "timezone": null,
      "date_utc": null,
      "distance": 5649,
      "type": "rower",
      "time": 8649,
      "time_formatted": "14:24.9",
      "workout_type": "JustRow",
      "source": "ErgData",
      "weight_class": "H",
      "verified": true,
      "ranked": false,
      "comments": null
    }
  },
  {
    "status_code": 409,
    "message": "Duplicate result"
  }
]
```

### Result

#### Get Result [GET](#logbook-users-result-get)`/api/users/{user}/results/{result_id}`

Get an individual result. For a full list of fields that are part of the result, see [Add Result](https://log.concept2.com/developers/documentation/#logbook-users-results-post). You can also return embedded resources for strokes, metadata and limited user data by passing them as a comma separated query string to include. e.g. ?include=strokes,metadata,user

#### Example URI

GET https://log.concept2.com/api/users/me/results/1

**URI Parameters**


user
:   `number or string` (required) **Example:**me

    Either the integer id of the user or ‘me’ as shorthand for authenticated user.

result\_id
:   `number` (required) **Example:**1

    The integer id of the workout

**Request**


##### Headers

```
Content-Type: application/json  
Authorization: Bearer ***
```

**Response  `200`**


##### Headers

```
Content-Type: application/json
```

##### Body

```
{
  "data": {
    "id": 3,
    "user_id": 1,
    "date": "2013-06-21 00:00:00",
    "distance": 23000,
    "type": "rower",
    "time": 152350,
    "time_formatted": "4:13:55.0",
    "workout_type": "unknown",
    "source": "Web",
    "weight_class": "H",
    "verified": false,
    "ranked": false,
    "comments": null,
    "privacy": "partners"
  }
}
```

#### Edit Result [PATCH](#logbook-users-result-patch)`/api/users/{user}/results/{result_id}`

Edit an existing workout. You can send across either the entire resource or just any changed values.

#### Example URI

PATCH https://log.concept2.com/api/users/me/results/1

**URI Parameters**


user
:   `number or string` (required) **Example:**me

    Either the integer id of the user or ‘me’ as shorthand for authenticated user.

result\_id
:   `number` (required) **Example:**1

    The integer id of the workout

**Request**


##### Headers

```
Content-Type: application/json  
Authorization: Bearer ***
```

##### Body

```
{
  "weight_class": "L",
  "comments": "Second row of the year."
}
```

**Response  `200`**


##### Headers

```
Content-Type: application/json
```

##### Body

```
{
  "data": {
    "id": 339,
    "user_id": 1,
    "date": "2015-05-05 03:15:41",
    "distance": 5649,
    "type": "rower",
    "time": 8649,
    "time_formatted": "14:24.9",
    "workout_type": "JustRow",
    "source": "ErgData",
    "weight_class": "L",
    "verified": true,
    "ranked": false,
    "comments": "Second row of the year.",
    "privacy": "partners"
  }
}
```

**Response  `422`**


Validation error - one or more fields is incorrect.

##### Headers

```
Content-Type: application/json
```

##### Body

```
{
  "message": "Could not update result.",
  "status_code": 422,
  "errors": {
    "distance": [
      "The distance field is required."
    ]
  }
}
```

#### Delete Result [DELETE](#logbook-users-result-delete)`/api/users/{user}/results/{result_id}`

Delete a result. **Note:** This cannot be undone.

#### Example URI

DELETE https://log.concept2.com/api/users/me/results/1

**URI Parameters**


user
:   `number or string` (required) **Example:**me

    Either the integer id of the user or ‘me’ as shorthand for authenticated user.

result\_id
:   `number` (required) **Example:**1

    The integer id of the workout

**Request**


##### Headers

```
Content-Type: application/json  
Authorization: Bearer ***
```

**Response  `200`**


##### Headers

```
Content-Type: application/json
```

##### Body

```
{
  "message": "Result deleted successfully"
}
```

**Response  `404`**


##### Headers

```
Content-Type: application/json
```

##### Body

```
{
  "message": "This workout does not exist for this user",
  "status_code": 404
}
```

**Response  `403`**


##### Headers

```
Content-Type: application/json
```

##### Body

```
{
  "message": "User does not have rights to this resource",
  "status_code": 403
}
```

### Stroke Data

#### Get Stroke Data [GET](#logbook-users-stroke-data-get)`/api/users/{user}/results/{result_id}/strokes`

Get stroke data for a workout. See **Add Result** for information on structure.

#### Example URI

GET https://log.concept2.com/api/users/me/results/9/strokes

**URI Parameters**


user
:   `number or string` (required) **Example:**me

    Either the integer id of the user or ‘me’ as shorthand for authenticated user.

result\_id
:   `number` (required) **Example:**9

    The integer id of the workout

**Request**


##### Headers

```
Content-Type: application/json  
Authorization: Bearer ***
```

**Response  `200`**


##### Headers

```
Content-Type: application/json
```

##### Body

```
{
  "data": [
    {
      "t": 0,
      "d": 0,
      "p": 0,
      "spm": 0,
      "hr": 0
    }
  ]
}
```

**Response  `404`**


##### Headers

```
Content-Type: application/json
```

##### Body

```
{
  "message": "This workout does not have any stroke data associated with it",
  "status_code": 404
}
```

#### Delete Strokes [DELETE](#logbook-users-stroke-data-delete)`/api/users/{user}/results/{result_id}/strokes`

Delete stroke data. **Note:** This cannot be undone.

#### Example URI

DELETE https://log.concept2.com/api/users/me/results/9/strokes

**URI Parameters**


user
:   `number or string` (required) **Example:**me

    Either the integer id of the user or ‘me’ as shorthand for authenticated user.

result\_id
:   `number` (required) **Example:**9

    The integer id of the workout

**Request**


##### Headers

```
Content-Type: application/json  
Authorization: Bearer ***
```

**Response  `200`**


##### Headers

```
Content-Type: application/json
```

##### Body

```
{
  "message": "Result deleted successfully"
}
```

**Response  `404`**


##### Headers

```
Content-Type: application/json
```

##### Body

```
{
  "message": "This workout does not exist for this user",
  "status_code": 404
}
```

**Response  `403`**


##### Headers

```
Content-Type: application/json
```

##### Body

```
{
  "message": "User does not have rights to this resource",
  "status_code": 403
}
```

### File Export

#### Get Result File Export [GET](#logbook-users-file-export-get)`/api/users/{user}/results/{result_id}/export/{type}`

Get a file export of a workout.

#### Example URI

GET https://log.concept2.com/api/users/me/results/9/export/one of `csv`, `fit`, or `tcx`

**URI Parameters**


user
:   `number or string` (required) **Example:**me

    Either the integer id of the user or ‘me’ as shorthand for authenticated user.

result\_id
:   `number` (required) **Example:**9

    The integer id of the workout

type
:   `string` (required) **Example:**one of `csv`, `fit`, or `tcx`

    The file type to export

**Request**


##### Headers

```
Content-Type: application/json  
Authorization: Bearer ***
```

**Response  `200`**


##### Headers

```
Content-Type: application/octet-stream  
Content-Length: 9999  
Content-Disposition: attachment; filename="concept2-logbook-workout-XXXXXXXX.type"
```

**Response  `404`**


##### Headers

```
Content-Type: application/json
```

##### Body

```
{
  "message": "Stroke data not found",
  "status_code": 404
}
```

## Webhook

Through your self-service developer portal, you can register and manage a webhook that will fire when a relevant result is added, updated, or deleted. Relevant results for a given client are those belonging to users who have authorized the client. When firing, the webhook will return one of `result-added`, `result-updated` or `result-deleted`, along with the result payload.

## Create or Update Result

When a result is created or updated for one of the users of your client, your webhook will receive a POST at the specified endpoint with the type of event (see above) and the result payload. This is the same information as a client would receive from requesting the result directly.

- Body

  ```
  {
          "data": {
            "type": "result-added",
            "result":
              {
                "id": 3,
                "user_id": 1,
                "date": "2013-06-21 00:00:00",
                "distance": 23000,
                "type": "rower",
                "time": 152350,
                "time_formatted": "4:13:55.0",
                "workout_type": "unknown",
                "source": "Web",
                "weight_class": "H",
                "verified": false,
                "ranked": false,
                "comments": null
              }
          }
      }
  ```

## Delete Result

When a result is deleted for one of the users of your client, your webhook will receive a POST at the specified endpoint with the type of event (see above) and the ID of the deleted result.

- Body

  ```
  {
      "data": {
        "type": "result-deleted",
        "result_id": 745
      }
  }
  ```

## Reminders

Endpoints for users who can’t remember their username and/or passwords. If the username is known, a reset email can be sent to the associated email address. If the username is not known, a list of usernames for that email address can be sent.

### Password Reset

#### Create Password Reset [POST](#reminders-password-reset-post)`/api/reminder/password`

Send a password reset email to the email account associated with a username.

#### Example URI

POST https://log.concept2.com/api/reminder/password

**Request**


##### Headers

```
Content-Type: application/json
```

##### Body

```
{
  "username": "Peter Parker"
}
```

**Response  `200`**


##### Body

```
{
  "message": "A password reset email has been sent to the email address for this username."
}
```

**Response  `422`**


Missing username.

##### Headers

```
Content-Type: application/json
```

##### Body

```
{
  "message": "Could not get user",
  "status_code": 422,
  "errors": {
    "username": [
      "Missing username"

    ]
  }
}
```

**Response  `404`**


No known user.

##### Headers

```
Content-Type: application/json
```

##### Body

```
{
  "message": "There are no users with that username.",
  "status_code": 404
}
```

### Username Reminder

#### Create Username Reminder [POST](#reminders-username-reminder-post)`/api/reminder/username`

Send any usernames associated with an email account to the specified email.

#### Example URI

POST https://log.concept2.com/api/reminder/username

**Request**


##### Headers

```
Content-Type: application/json
```

##### Body

```
{
  "email": "peterp@concept2.com"
}
```

**Response  `200`**


##### Body

```
{
  "message": "A username reminder has been sent to your email address."
}
```

**Response  `422`**


Missing or incorrect email.

##### Headers

```
Content-Type: application/json
```

##### Body

```
{
  "message": "Could not get usernames",
  "status_code": 422,
  "errors": {
    "email": [
      "You must enter a valid email address"
    ]
  }
}
```

**Response  `404`**


Unknown email address.

##### Headers

```
Content-Type: application/json
```

##### Body

```
{
  "message": "There are no users with that email address.",
  "status_code": 404
}
```

## Logbook Challenges

This resource is for fetching a list of Logbook challenges.

There is no need for an authorization token for these endpoints.

### All challenges

#### Get all challenges [GET](#logbook-challenges-all-challenges-get)`/api/challenges`

Fetch a paginated collection of all challenges.

#### Example URI

GET https://log.concept2.com/api/challenges

**Request**


##### Headers

```
Content-Type: application/json
```

**Response  `200`**


##### Headers

```
Content-Type: application/json
```

##### Body

```
{
  "data": [
    {
      "key": "tour-de-skierg",
      "name": "Tour De SkiErg",
      "season": 2019,
      "start": "2019-02-01",
      "end": "2019-02-28",
      "activity": "Ski",
      "category": "Individual",
      "description": "A different event challenge each week",
      "short_description": false,
      "link": "https://log.concept2.com/challenges/tour-de-skierg",
      "image": "https://media.concept2.com/assets/challenges/tour-de-skierg/2019/images/large/tourdeskierg-2019-logbook.png"
    },
    {
      "key": "military",
      "name": "Military Challenge",
      "season": 2019,
      "start": "2019-02-01",
      "end": "2019-02-28",
      "activity": "Row/Ski/Ride",
      "category": "Individual",
      "description": "If you're in a military affiliation, help them row, ski or ride as many meters as possible",
      "short_description": "Military challenge aiming for as many meters as possible",
      "link": "https://log.concept2.com/challenges/military",
      "image": "https://media.concept2.com/assets/challenges/military/2019/images/large/military-2019-logbook.png"
    },
    {
      "key": "valentine",
      "name": "Valentine Challenge",
      "season": 2019,
      "start": "2019-02-09",
      "end": "2019-02-14",
      "activity": "Row/Ski/Ride",
      "category": "Individual",
      "description": "Complete a total of 14,000m",
      "short_description": false,
      "link": "https://log.concept2.com/challenges/valentine",
      "image": "https://media.concept2.com/assets/challenges/valentine/2019/images/large/valentine-2019-logbook.png"
    },
    {
      "key": "mud-season-madness",
      "name": "Mud Season Madness",
      "season": 2019,
      "start": "2019-03-01",
      "end": "2019-03-31",
      "activity": "Row/Ski/Ride",
      "category": "Individual",
      "description": "Do 5000m or 10,000m meters each day for 25 days or more",
      "short_description": false,
      "link": "https://log.concept2.com/challenges/mud-season-madness",
      "image": "https://media.concept2.com/assets/challenges/mud-season-madness/2019/images/large/mudseason-2019-logbook.png"
    },
    {
      "key": "wec",
      "name": "World Erg Challenge",
      "season": 2019,
      "start": "2019-03-15",
      "end": "2019-04-15",
      "activity": "Row/Ski/Ride",
      "category": "Team",
      "description": "Complete as many meters as you can during the timeframe indicated",
      "short_description": "Help your team row, ski or ride as many meters as possible",
      "link": "https://log.concept2.com/challenges/wec",
      "image": "https://media.concept2.com/assets/challenges/wec/2019/images/large/worlderg-2019-logbook.png"
    },
    {
      "key": "marathon",
      "name": "Global Marathon",
      "season": 2020,
      "start": "2019-05-01",
      "end": "2019-05-15",
      "activity": "Row/Ski/Ride",
      "category": "Individual",
      "description": "Row or ski either a full (42,195m) or half (21,097m) marathon, or ride for 100,000m or 50,000m, all in one workout",
      "short_description": "Complete either a full or half marathon in one workout",
      "link": "https://log.concept2.com/challenges/marathon",
      "image": "https://media.concept2.com/assets/challenges/marathon/2020/images/large/maracentury-2019-logbook.png"
    }
  ],
  "meta": {
    "pagination": {
      "total": 24,
      "count": 6,
      "per_page": 6,
      "current_page": 1,
      "total_pages": 4,
      "links": {
        "next": "http://log.concept2.com/api/challenges?page=2"
      }
    }
  }
}
```

### Current challenges

#### Get current challenges [GET](#logbook-challenges-current-challenges-get)`/api/challenges/current`

Get current active challenges only.

#### Example URI

GET https://log.concept2.com/api/challenges/current

**Request**


##### Headers

```
Content-Type: application/json
```

**Response  `200`**


##### Headers

```
Content-Type: application/json
```

##### Body

```
{
  "data": [
    {
      "key": "mud-season-madness",
      "name": "Mud Season Madness",
      "season": 2019,
      "start": "2019-03-01",
      "end": "2019-03-31",
      "activity": "Row/Ski/Ride",
      "category": "Individual",
      "description": "Do 5000m or 10,000m meters each day for 25 days or more",
      "short_description": false,
      "link": "https://log.concept2.com/challenges/mud-season-madness",
      "image": "https://media.concept2.com/assets/challenges/mud-season-madness/2019/images/large/mudseason-2019-logbook.png"
    }
  ]
}
```

### Upcoming challenges

#### Get upcoming challenges [GET](#logbook-challenges-upcoming-challenges-get)`/api/challenges/upcoming/{days}`

Get challenges that start within the days specified.

#### Example URI

GET https://log.concept2.com/api/challenges/upcoming/60

**URI Parameters**


days
:   `number` (optional) **Example:**60

    Defaults to 30 days if not passed.

**Request**


##### Headers

```
Content-Type: application/json
```

**Response  `200`**


##### Headers

```
Content-Type: application/json
```

##### Body

```
{
  "data": [
    {
      "key": "mud-season-madness",
      "name": "Mud Season Madness",
      "season": 2019,
      "start": "2019-03-01",
      "end": "2019-03-31",
      "activity": "Row/Ski/Ride",
      "category": "Individual",
      "description": "Do 5000m or 10,000m meters each day for 25 days or more",
      "short_description": false,
      "link": "https://log.concept2.com/challenges/mud-season-madness",
      "image": "https://media.concept2.com/assets/challenges/mud-season-madness/2019/images/large/mudseason-2019-logbook.png"
    }
  ]
}
```

### Recent challenges

#### Get recent challenges [GET](#logbook-challenges-recent-challenges-get)`/api/challenges/recent/{days}`

Get challenges that have finished with the days specified.

#### Example URI

GET https://log.concept2.com/api/challenges/recent/60

**URI Parameters**


days
:   `number` (optional) **Example:**60

    Defaults to 30 days if not passed.

**Request**


##### Headers

```
Content-Type: application/json
```

**Response  `200`**


##### Headers

```
Content-Type: application/json
```

##### Body

```
{
  "data": [
    {
      "key": "mud-season-madness",
      "name": "Mud Season Madness",
      "season": 2019,
      "start": "2019-03-01",
      "end": "2019-03-31",
      "activity": "Row/Ski/Ride",
      "category": "Individual",
      "description": "Do 5000m or 10,000m meters each day for 25 days or more",
      "short_description": false,
      "link": "https://log.concept2.com/challenges/mud-season-madness",
      "image": "https://media.concept2.com/assets/challenges/mud-season-madness/2019/images/large/mudseason-2019-logbook.png"
    }
  ]
}
```

### Challenges for Season

#### Get challenges for a season [GET](#logbook-challenges-challenges-for-season-get)`/api/challenges/season/{season}`

Get challenges for a specific season.

#### Example URI

GET https://log.concept2.com/api/challenges/season/2014

**URI Parameters**


season
:   `number` (required) **Example:**2014

    The logbook season (which runs May 1 through April 30) you need the challenges for.

**Request**


##### Headers

```
Content-Type: application/json
```

**Response  `200`**


##### Headers

```
Content-Type: application/json
```

##### Body

```
{
  "data": [
    {
      "key": "wec",
      "name": "World Erg Challenge",
      "season": 2019,
      "start": "2019-03-15",
      "end": "2019-04-15",
      "activity": "Row/Ski/Ride",
      "category": "Team",
      "description": "Complete as many meters as you can during the timeframe indicated",
      "short_description": "Help your team row, ski or ride as many meters as possible",
      "link": "https://log.concept2.com/challenges/wec",
      "image": "https://media.concept2.com/assets/challenges/wec/2019/images/large/worlderg-2019-logbook.png"
    },
    {
      "key": "marathon",
      "name": "Global Marathon",
      "season": 2020,
      "start": "2019-05-01",
      "end": "2019-05-15",
      "activity": "Row/Ski/Ride",
      "category": "Individual",
      "description": "Row or ski either a full (42,195m) or half (21,097m) marathon, or ride for 100,000m or 50,000m, all in one workout",
      "short_description": "Complete either a full or half marathon in one workout",
      "link": "https://log.concept2.com/challenges/marathon",
      "image": "https://media.concept2.com/assets/challenges/marathon/2020/images/large/maracentury-2019-logbook.png"
    }
  ]
}
```

### Non-Challenge Events

#### Get events for a year [GET](#logbook-challenges-non-challenge-events-get)`/api/challenges/events/{year}`

Get non-challenge events for a year.

#### Example URI

GET https://log.concept2.com/api/challenges/events/2023

**URI Parameters**


year
:   `number` (required) **Example:**2023

    The calendar year to retrieve events for.

**Request**


##### Headers

```
Content-Type: application/json
```

**Response  `200`**


##### Headers

```
Content-Type: application/json
```

##### Body

```
{
    "data": [
        {
            "name": "World Rowing Virtual Indoor Sprints",
            "year": "2023",
            "start": "2023-03-08",
            "end": "2023-03-12",
            "activity": "Row",
            "category": "Individual",
            "description": "A worldwide virtual 1000 meter race on the RowErg.",
            "short_description": false,
            "link": "https://log.concept2.com/challenges/indoor-sprints"
            "image": "https://log.concept2.com/build/images/challenges/indoor_sprints/2023/logo.jpg"
        },
        {
            "name": "BikeErg World Sprints",
            "year": "2023",
            "start": "2023-07-05",
            "end": "2023-07-09",
            "activity": "Ride",
            "category": "Individual",
            "description": "A worldwide virtual 1000 meter race on the BikeErg.",
            "short_description": false,
            "link": "https://log.concept2.com/challenges/bikeerg-sprints"
            "image": "https://log.concept2.com/build/images/challenges/bikeerg_sprints/logo.png"
        },
        {
            "name": "SkiErg World Sprints",
            "year": "2023",
            "start": "2023-11-09",
            "end": "2023-11-12",
            "activity": "Ski",
            "category": "Individual",
            "description": "A worldwide virtual 1000 meter race on the SkiErg.",
            "short_description": false,
            "link": "https://log.concept2.com/challenges/skierg-sprints"
            "image": "https://log.concept2.com/build/images/challenges/skierg_sprints/logo.png"
        }
    ]
}
```

