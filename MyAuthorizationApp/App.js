/**
 * @format
 * @flow
 */

import React, {Component} from 'react';
import {StyleSheet, Text, View, Button, Linking, AsyncStorage} from 'react-native';
import qs from 'qs'; // npm install --save qs
import randomString from 'random-string'; // npm install --save random-string
import Hashes from 'jshashes'; // npm install --save jshashes
import URL from 'url-parse'; // npm install --save url-parse

import Config from './env';



function sha256base64urlencode(str) {
  // https://tools.ietf.org/html/rfc7636#appendix-A
  // https://tools.ietf.org/html/rfc4648#section-5
  return new Hashes.SHA256().b64(str)
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+/g, '');
}


type Props = {};
export default class App extends Component<Props> {
  state = {};

  handleOpenUrl = (url) => {
    this.handleRedirectUri(url);
  }
  
  componentDidMount() {
    Linking.addEventListener("url", this.handleOpenUrl);
    Linking.getInitialURL().then(url => {
      if (url) this.handleRedirectUri(url);
    });
  }

  componentWillUnmount() {
    Linking.removeEventListener("url", this.handleOpenUrl);
  }

  handleRedirectUri(urlString) {
    const url = new URL(urlString, true);
    const {code, state} = url.query;

    if (!code) return;

    const providerName = url.pathname.split("/")[2];
    const loginProvider = loginProviders[providerName];

    const {token_endpoint, grant_type, client_id, redirect_uri} = loginProvider;

    Promise.all([
      AsyncStorage.getItem("state"),
      AsyncStorage.getItem("code_verifier")
    ]).then(([request_state, code_verifier]) => {
      AsyncStorage.removeItem('state');
      AsyncStorage.removeItem('code_verifier');
      if (!code_verifier) return;
      if (state != request_state) {
        console.warn("CSRF attack!");
        return;
      }

      const payload = {code, code_verifier, client_id, redirect_uri, grant_type};
      console.log(qs.stringify(payload));
      return fetch(token_endpoint, {
        method: 'POST',
        headers: {
          'Content-type': 'application/x-www-form-urlencoded'
        },
        body: qs.stringify(payload)
      }).then(resp => resp.json())
      .then(user => this.setState({user}))
      .catch(err => {
        console.warn("something went wrong", err);
      });
    });
  }

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
        <Text style={styles.welcome}>Welcome {user.username}!</Text>
      </View>
    );
  }
}

const BACKEND = Config.BACKEND;

const loginProviders = {
  // For configuration values, see https://accounts.google.com/.well-known/openid-configuration
  // For Administration, see https://console.developers.google.com/apis/credentials
  google: {
    title: "Log in with Google",
    redirect_uri: BACKEND + '/oauth2/google/oauth2callback',
    client_id: Config.GOOGLE_CLIENT_ID,
    response_type: 'code',
    scope: 'profile email',
    authorization_endpoint: "https://accounts.google.com/o/oauth2/v2/auth",
    token_endpoint: BACKEND + "/oauth2/google/token",
    grant_type: "authorization_code"
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
