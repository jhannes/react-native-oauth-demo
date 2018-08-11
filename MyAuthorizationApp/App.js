/**
 * @format
 * @flow
 */

import React, {Component} from 'react';
import {Platform, StyleSheet, Text, View, Button, Linking, AsyncStorage} from 'react-native';
import Config from 'react-native-config';
import qs from 'qs'; // npm install --save qs
import randomString from 'random-string'; // npm install --save random-string
import sha256 from 'fast-sha256'; // npm install --save fast-sha256
import base64url from 'base64url'; // npm install --save base64url

const instructions = Platform.select({
  ios: 'Press Cmd+R to reload,\n' + 'Cmd+D or shake for dev menu',
  android:
    'Double tap R on your keyboard to reload,\n' +
    'Shake or press menu button for dev menu',
});

type Props = {};
export default class App extends Component<Props> {
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

    return (
      <View style={styles.container}>
        <Text style={styles.welcome}>Welcome to React Native!</Text>
        <Text style={styles.instructions}>To get started, edit App.js</Text>
        <Text style={styles.instructions}>{instructions}</Text>
      </View>
    );
  }
}

console.log(Config);

const BACKEND = 'http://localhost:3000'

const loginProviders = {
  // For configuration values, see https://accounts.google.com/.well-known/openid-configuration
  // For Administration, see https://console.developers.google.com/apis/credentials
  google: {
    title: "Log in with Google",
    client_id: '537637163196-qq8po4809n8t932l0g0ivlo1hqprrcec.apps.googleusercontent.com',
    redirect_uri: BACKEND + '/oauth2/google/oauth2callback',
    authorization_endpoint: "https://accounts.google.com/o/oauth2/v2/auth",
    token_endpoint: BACKEND + "/oauth2/google/token",
    response_type: 'code',
    scope: 'profile email'
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



const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5FCFF',
  },
  welcome: {
    fontSize: 20,
    textAlign: 'center',
    margin: 10,
  },
  instructions: {
    textAlign: 'center',
    color: '#333333',
    marginBottom: 5,
  },
});
