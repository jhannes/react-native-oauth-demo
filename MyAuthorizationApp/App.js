/**
 * @format
 * @flow
 */

import React, {Component} from 'react';
import {StyleSheet, Text, View, Button, Linking, AsyncStorage} from 'react-native';
import qs from 'qs'; // npm install --save qs
import randomString from 'random-string'; // npm install --save random-string
import URL from 'url-parse'; // npm install --save url-parse
import Hashes from 'jshashes'; // npm install --save jshashes


function sha256base64urlencode(str) {
  // https://tools.ietf.org/html/rfc7636#appendix-A
  // https://tools.ietf.org/html/rfc4648#section-5
  return new Hashes.SHA256().b64(str)
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+/g, '');
}


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
    //  - Protect against other apps who register our application url scheme
    const code_verifier = randomString({length: 40});
    const code_challenge = sha256base64urlencode(code_verifier);
    const code_challenge_method = "S256";

    // Protect against rogue web pages that try redirect the user to authorize (XSRF)
    const state = randomString();

    const params = {client_id, redirect_uri, response_type, scope, state, code_challenge, code_challenge_method};
    const authorizationUrl = authorization_endpoint + "?" + qs.stringify(params);
    
    Promise.all([
      AsyncStorage.setItem("code_verifier", code_verifier),
      AsyncStorage.setItem("state", state)  
    ]).then(() => {
      console.log(authorizationUrl);
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
