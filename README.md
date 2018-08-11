# Building React Native applications with Oauth2 for Azure AD and ID-porten

In this tutorial, I will walk you through setting up a React Native application to autenticate with some important Oauth2 providers: Google, Azure Active Directory and (for Norwegians) ID-porten.

If your application can know which user it talks with for sure, you can do anything. If you cannot trust your user, you can do nothing.

This is why Oauth2 is important. Oauth2 provides a common way for Identity Providers to link their users to third party applications. "Connect with Facebook", or Google, or Twitter, or GitHub has enabled many new applications in the consumer market.

But in the business and public sector, these Identity Providers will not do. Luckily, you can use other providers here.

Very many organizations use Active Directory as a hub in their Identity and Access Management. Most of these organizations have one or more cloud-based applications that authorize with their Active Directory through Azure AD and Oauth2. Through multi-tenant Azure AD applications, you can authenticate your app with any organization's Active Directory, without involving any admins in these organizations. This means that you can know for sure if a user is recognized by a particular business.

If you are developing solutions in the Norwegian public sector, you may also be interested in knowing that ID-porten, the national portal for authorization of end users now supports Oauth2 and OpenID Connect. This means for sure that you can recognize that you're talking to a Norwegian resident.

When developing native applications, including React Native, the strongly recommended approach is to open a web browser to authenticate the user. In order to attach the login session with the app, you need to use application deep links to return the authentication information to the app. This is not difficult, but it's also not well documented. Hence this article.

## Overview of the login flow

1. An unidentified user opens the app
2. The app presents the user with a number of login options
3. When the user chooses a login provider, the app opens *an external browser window* with the selected provider
4. The user performs authorization (if needed) and gives consent (if needed)
5. The browser is redirected back to an URL controlled by the app. This relaunches the app an autentication code
6. The app sends the authentication code to it's own backend, which adds a client_secret (only known by the backend) and forwards the request to the identity provider's token endpoint
7. The backend server receives access_token and optionally identity_tokens and refresh_tokens. It uses these to establish the user's identity
8. The backend server returns the login information to the app, where it can be displayed to the user

![Sequence Diagram](http://www.plantuml.com/plantuml/proxy?src=https://raw.github.com/jhannes/react-native-oauth-demo/master/doc/react-native-oauth2-sequence.puml)

With the theory out of the way, let's get started.

### Step 1: Create a React Native application

I will be demonstrating the app on Android, but it will work more or less the same in iOS. You need ANDROID_SDK and an emulator to play along.

```bash
npm install -g react-native-cli
react-native init MyAuthorizationApp
cd MyAuthorizationApp
npm install
react-native run-android
# Some dependencies for later
npm install --save qs base64url fast-sha256 random-string
```

I recommend using Visual Studio Code for React Native development. Open the MyAuthorizationApp directory in Code and install the React Native extension. Select Debug > Add Configuration and add React Native. Now you can simply press F5 to start the debugger.

### Setting up the login provider (using Google as an example)

Every login provider will require some setup. For Google, this is what you need to do:

1. Create a new project in [Google APIs developer console](https://console.developers.google.com/projectcreate)
2. After you have selected a name, you need to wait a couple of minutes for the project to be created
3. Go to the [API credentials](https://console.developers.google.com/apis/credentials) screen
4. Select "Create credential" > "Oauth client" and select Application type "Web application"
5. Authorized redirect URIs are the most important. For now, let's just configure localhost.
   We need the redirect URIs to specify which login provider we're dealing with, so
   http://localhost:3000/oauth2/google/oauth2callback is a good redirect URI
6. When you complete the registration, you will get a client id and a client secret. At first
   we will need to save the client id to a file named `.env`:
   ```
   GOOGLE_CLIENT_ID=...
   GOOGLE_REDIRECT_URI=http://localhost:3000/oauth2/google/oauth2callback
   ```
7. We will use [React Native Config](https://github.com/luggit/react-native-config) to
   handle the configuration. Run `npm install react-native-config --save-dev` to
   install it, and put the line `react-native link react-native-config` to install
   the platform modules.

### Step 2: Redirect unauthenticated users to log in

Update the `App` in `App.js`

```javascript
import React from 'react';
import {Platform, StyleSheet, Text, View, Button} from 'react-native';

export default class App extends React.Component {
  state = {};

  render() {
    const {user} = this.state;
    if (!user) {
    return (
      <View style={styles.container}>
        <LoginView />
        </View>
      );
    }
    // Keep the existing code
  }
}
```

The LoginView lets the user choose how to log in:

```javascript
const loginProviders = {
  google: {
    title: "Log in with Google"
  },
  azure: {
    title: "Log in with your organization"
  },
  idPorten: {
    title: "Log in with ID-porten"
  }
};

class LoginView extends React.Component {
  state = {}

  handleLogin = (key) => {
    const loginProvider = loginProviders[key];
    this.setState({loginProvider});
  }

  render() {
    const {loginProvider} = this.state;
    const handleLogin = this.handleLogin;

    if (loginProvider) {
      return <Text>Logging you in with {loginProvider.title}</Text>;
    }

    return (
      <View>
        <Text>Choose how you want to log in</Text>
        {Object.entries(loginProviders).map(([key,provider]) =>
          <Button title={provider.title} onPress={() => handleLogin(key)} key={key} />)}
      </View>
    );
  }
}
```

If you run this code, you will be presented with the login options, but nothing much will happen when you select one.

### Handle the login

When the user selects a login provider, we need to create an authorization URL and open a browser to that URL:

```javascript
import {Platform, StyleSheet, Text, View, Button, Linking, AsyncStorage} from 'react-native';
import Config from 'react-native-config'; // We added this with npm install --save react-native-config
import qs from 'qs'; // npm install --save qs
import randomString from 'random-string'; // npm install --save random-string
// ...

const loginProviders = {
  // For configuration values, see https://accounts.google.com/.well-known/openid-configuration
  // For Administration, see https://console.developers.google.com/apis/credentials
  google: {
    title: "Log in with Google",
    client_id: Config.GOOGLE_CLIENT_ID,
    redirect_uri: Config.GOOGLE_REDIRECT_URI,
    authorization_endpoint: "https://accounts.google.com/o/oauth2/v2/auth",
    token_endpoint: Config.BACKEND + "/oauth2/google/token"
  },
  // We'll get around to the others later

// ...

  handleLogin = (key) => {
    const loginProvider = loginProviders[key];
    this.setState({loginProvider});
    const {client_id, authorization_endpoint, redirect_uri, response_type, scope} = loginProvider;

    // PKCE - https://tools.ietf.org/html/rfc7636
    const code_verifier = randomString({length: 40});
    const code_challenge = base64url(sha256(code_verifier));
    const code_challenge_method = "S256";

    const params = {client_id, code_challenge, code_challenge_method, redirect_uri, response_type, scope};
    const authorizationUrl = authorization_endpoint + "?" + qs.stringify(params);

    AsyncStorage.setItem("code_verifier", code_verifier).then(() => {
        Linking.openURL(authorizationUrl);
    }).catch(console.warn);
  }
```

When you run this application, the app will open an external web browser on device with the appropriate login screen. Of course, the redirect_uri needs to bring the user back to the application. Right now it just goes to a URL where nothing lives.

### Handle the redirect

When the user logs in and consents to the application getting to know them better, the login provider redirects the user's browser to the redirect_uri. For development purposes, we set this to http://localhost:3000. When you debug in the iPhone emulator, localhost URLs will automatically redirect to the host computer. In order to achieve the same in Android, just use the following ADB command:

`adb reverse tcp:3000 tcp:3000`

With that out of the way, we need to run a web server that will handle the redirect and redirect the user again, this time to an application URL. Let's create the server with Express.

```bash
mkdir MyAuthorizationServer
cd MyAuthorizationServer
npm init -y
npm install --save express
```

A simple `server.js`-file is all that's needed:

```
const express = require('express')
const app = express()

app.get('/oauth2/:loginProvider/auth', (req, res) => {
    const returnUrl = redirect_uri + "?" + req.query;
    res.redirect(returnUrl);
});

app.listen(3000, () => console.log('Example app listening on port 3000!'))
```




### Handle the redirect (Android)

In order to handle the redirect back to the application, your application must register the URI with the mobile operating system. In Android, this is done by updating the `android/app/src/main/AndroidManifest.xml` file:

```xml
<application
	android:name=".MainApplication"
	android:label="@string/app_name"
	android:icon="@mipmap/ic_launcher"
	android:allowBackup="false"
	android:launchMode="singleTask"
	android:theme="@style/AppTheme">
	<activity
	android:name=".MainActivity"
	android:label="@string/app_name"
	android:configChanges="keyboard|keyboardHidden|orientation|screenSize"
	android:windowSoftInputMode="adjustResize">
	<intent-filter>
		<action android:name="android.intent.action.MAIN" />
		<category android:name="android.intent.category.LAUNCHER" />
	</intent-filter>
	<intent-filter android:label="filter_react_native">
		<action android:name="android.intent.action.VIEW"/>
		<category android:name="android.intent.category.DEFAULT"/>
		<category android:name="android.intent.category.BROWSABLE"/>
		<data android:scheme="http" android:host="localhost" android:pathPrefix="/oauth2" />
	</intent-filter>
</activity>
```

*You have to restart the debugger and run `npm run android` (or F5 in VS Code) to pick up changes in the `AndroidManifest.xml`.*

### Handle the redirect (iOS)

iOS normally does not like apps to handle http(s) URLs. Instead, you should set up XCode to handle `myoauth2app://`-urls. See https://developer.apple.com/documentation/uikit/core_app/allowing_apps_and_websites_to_link_to_your_content/defining_a_custom_url_scheme_for_your_app. In React Native, you need to do make the following changes:

1. Update the app info.plist to contain `myoauth2app` as a URL
2. Add `openURL` and `continueUserActivity` to `ios/MyAuthorizationApp/AppDelegate.m`. See https://facebook.github.io/react-native/docs/linking

However, Open ID providers don't let you use custom URL schemes like `myoauth2app://` for your redirect_uri. The solution is to redirect to a backend (during development http://localhost:3000 works for the iOS emulator) which redirects back to the app URL.

...

### Requesting access token

When the application is reopened, we can get the appropriate information by calling Linking.getCurrentURL()

```javascript
class App extends React.Component {

	componentDidMount() {
		if (!this.state.user) {
			Linking.getCurrentURL(url => {
				if (!url) return;

				const {code} = parseUrl(url).query;
				AsyncStorage.getItem("code_verifier").then(code_verifier => {
					AsyncStorage.removeItem("code_verifier");
					const {token_uri, client_id, redirect_uri} = loginProvider;
					const payload = {
						client_id, code, code_verifier, redirect_uri
					};

					fetch(token_uri, {
						method: "POST",
						body: qs(payload)
					}).then(res => res.json())
					.then(user => this.setState({user}));
				});
			});
		}
	}
}
```

Importantly, the `token_uri` *should not* be the real token URI for the login provider. Instead, it should be your own backend. In my case, I implemented this with Express:

```javascript
app.post('/oauth2/:provider/token', (res, req) => {
	const {client_id, code, code_verifier, redirect_uri} = res.body;
	const loginProvider = providers[res.provider];
	const {token_uri, client_secret} = loginProvider;
	fetch(token_uri, {
		method: 'POST',
		body: qs({client_id, client_secret, code, code_verifier, redirect_uri})
	}).then(response => response.json())
	.then(response => JSON.parse(base64decode(response.id_token)))
	.then(id_token => res.send({
		username: id_token.user_name
	}));
});
```

### Display the user information

Now all that's left is to display the user information

```javascript
class App extends React.Component {
	state = {};

	render() {
		const {user} = this.state;

		if (!user) {
			return <LoginView />;
		}
		return (
			<View>
				<Text>Welcome to the app {user.username}!</Text>
			</View>
		);
	}
}
```

## Conclusions

1. Oauth2 is great for many authentication scenarios, whether commercial, internal in an organization or in public sector
2. Standardization makes it easy to integrate many login providers
3. Mobile apps should use an external browser to authenticate the user and return to the app via a registered URL [RFC link!]
4. Mobile apps should use code_challenge and code_verifier (AKA PKCE) to defeat malicious apps on the same OS [RFC link]
5. In Android, use .... intent to register a browser URL; in iOS, use xxxx.
6. Mobile apps need a backend to protect the client_secret for the token request

See the complete code on my github account.



Todo: Here is some code that I should use somewhere better.

```javascript
componentDidMount() {
	const {user, loginProvider} = this.state;
	if (!user && loginProvider) {
		return Linking.getInitialURL().then(url => {
			const {code} = parseUrl(url).query;
			if (code) {
				AsyncStorage.getItem("code_verifier").then(code_verifier => {
					const {token_uri, client_id, redirect_uri} = loginProvider;
					fetch(token_uri, {client_id, redirect_uri, code, code_verifier})
						.then(res => res.json())
						.then(user => this.setState({user}));
				});
			} else {
				const code_verifier = randomString();
				AsyncStorage.setItem("code_verifier", code_verifier).then(() => {
					const {auth_uri, client_id, redirect_uri} = loginProvider;
					const code_challenge = sha256(code_verifier);
					Linking.openURL(auth_uri + "?" + qs({client_id, redirect_uri, code_challenge, code_challenge_method: "s256"}))
				});
			}
		});
	}
}

render() {
	const {user, loginProvider} = this.state;
	if (user) {
		return (
			<View>
				<Text>Welcome to the app {user.username}!</Text>
			</View>
		);		
	}
	if (!loginProvider) {
		return (
			<View>
				<Text>Choose how you want to log in</Text>
				<Button
					title="Google"
					onClick={() => this.handleLogin(googleLogin)} />
				<Button
					title="Active Directory"
					onClick={() => this.handleLogin(azureAdLogin)} />
				<Button
					title="ID-porten"
					onClick={() => this.handleLogin(idPortenLogin)} />
			</View>);
	}
	return (
		<View>
			<Text>Logging you in with {loginProvider.title}</Text>
		</View>);
	);
}


}


```