import React from 'react';
import { StyleSheet, Text, View, Button } from 'react-native';
import { Linking, AsyncStorage } from 'react-native';

import URL from 'url-parse';
import hash from 'hash.js';


// TODO
//
// * Parse return parameter from server and use code
//   * URL parser on server and client
// * PKCE
//   * SHA256
//   * Better random string
// * Dummy provider
//   * Parse url and payload in Express
//   * Reject reuse of code
// * Fetch existing session on server - perhaps through AsyncStorage?
// * Implement all the way with AzureAD
//   * Create an appropriate redirect_uri
//   * Token exchange on server
// * Implenent with ID-porten
//
// Weirdness
// * Only use URL when in the process of logging in (why didn't this work?)
// * WelcomeComponent: Why can't I get local functions to work?? Maybe LoginButton component?

function randomString() {
  return Math.random().toString(36).slice(2);
}

function qs(obj) {
  const params = [];
  for (const p in obj) {
    if (obj.hasOwnProperty(p)) {
      params.push(encodeURIComponent(p) + "=" + encodeURIComponent(obj[p]));
    }
  }
  return params.join("&");
}

function storeCodeVerifier({code_verifier, code_challenge}) {
  return AsyncStorage.setItem("code_verifier", JSON.stringify({code_verifier, code_challenge}));
}

function retrieveCodeVerifier() {
  return AsyncStorage.getItem("code_verifier").then(string => JSON.parse(string));
}

const idPorten = {
  name: "idPorten",
  authenticationUrl:  "http://localhost:3000/oauth2/idPorten/auth", // should be e.g. https://oidc-ver2.difi.no/idporten-oidc-provider/authorize
  token_url:          "http://localhost:3000/oauth2/idPorten/token", // Should be out own server, protecting the client_secret
  // To test on localhost from android, do `adb forward tcp:3000 tcp:3000
  client_id: "abc-idPorten",
  redirect_uri: "https://www.example.com/oauth2/idPorten/oauth2callback" // Should match URL in AndroidManifest.xml
};
const azureAd = {
  name: "azureAd",
  authenticationUrl:  "http://localhost:3000/oauth2/azureAd/auth", // should be https://login.microsoft.com/common/oauth2/authorize
  token_url:          "http://localhost:3000/oauth2/azureAd/token", // Should be our own server, protecting the client_secret
  // To test on localhost from android, do `adb forward tcp:3000 tcp:3000
  client_id: "abc-azure",
  redirect_uri: "https://www.example.com/oauth2/azureAd/oauth2callback" // Should match URL in AndroidManifest.xml
};
const dummyLogin = {
  name: "dummyLogin",
  authenticationUrl:  "http://localhost:3000/oauth2/dummyLogin/auth",
  token_url:          "http://localhost:3000/oauth2/dummyLogin/token",
  // To test on localhost from android, do `adb forward tcp:3000 tcp:3000
  client_id: "abc-dummyLogin",
  redirect_uri: "https://www.example.com/oauth2/dummyLogin/oauth2callback"
};

const loginProviders = {
  idPorten, azureAd, dummyLogin
};

function getCurrentUser() {
  return new Promise((resolve, reject) => {
    resolve();
  });
}

function handleFetchErrors(res) {
  if (!res.ok) throw res;
  return res;
}

function loginUser(loginProvider, code, code_verifier) {
  const {token_url, client_id, response_uri} = loginProvider;
  return fetch(token_url, {
    method: "POST",
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: qs({client_id, code, code_verifier, response_uri})
  })
  .then(handleFetchErrors)
  .then(res => res.json());
}


const UserContext = React.createContext();

class UserView extends React.Component {
  render() {
    const {user, onLogout} = this.props;
    return (
      <View>
        <Text>Welcome {user.name}</Text>
        <Button title="Log out" onPress={onLogout} />
      </View>
    );  
  }
}

function UserContainer() {
  return <UserContext.Consumer>{({user, onLogout}) => <UserView user={user} onLogout={onLogout} />}</UserContext.Consumer>;
}


class LoginComponent extends React.Component {

  componentDidMount() {
    const {loginProvider, code, state, onLogin} = this.props;

    if (code) {
      retrieveCodeVerifier().then(({code_verifier, code_challenge}) => {
        if (code_challenge === state) {          
          loginUser(loginProvider, code, code_verifier)
            .then(user => onLogin(user))
            .catch(err => {
              console.log(err);
              this.setState({err});
              onLogin(null);
            });
          } else {
            this.startLogin(loginProvider);
          }
        });
    } else {
      this.startLogin(loginProvider);
    }
  }

  startLogin(loginProvider) {
    const code_verifier = randomString();
    const code_challenge_method = "s256";
    const code_challenge = hash.sha256().update(code_verifier).digest('hex');

    storeCodeVerifier({code_verifier, code_challenge}).then(() => {
      const state = code_challenge;
      const {authenticationUrl, client_id, redirect_uri} = loginProvider;
      const url = authenticationUrl + "?" + qs({client_id, code_challenge, code_challenge_method, redirect_uri, state});
      Linking.openURL(url);
    });
  }
  
  render() {
    const {loginProvider} = this.props;
    return (
      <View>
        <Text>Logging in with {loginProvider.name}</Text>
      </View>);
  }
}

function LoginButton(props) {
  const {loginProvider, onLogin} = props;
  return <Button title={"Logg inn med " + loginProvider.title} onPress={() => onLogin(loginProvider)} />
}

class WelcomeComponent extends React.Component {

  handleLogin(loginProvider) {
    this.props.onLogin({loginProvider});
  }

  handleLoginIdPorten = e => {
    this.handleLogin(idPorten);
  }

  handleLoginAzureAd = e => {
    this.handleLogin(azureAd);
  }

  render() {
    return (
      <View style={styles.container}>
        <Text>Vennligst logg inn</Text>
        <Button title="Logg inn med ID-porten" onPress={this.handleLoginIdPorten} />
        <Button title="Logg inn med organisasjonsbruker" onPress={this.handleLoginAzureAd} />
      </View>
    );
  }
}

export default class App extends React.Component {
  state = {};

  componentDidMount() {
    Linking.getInitialURL().then(urlString => {
      if (urlString && urlString.startsWith("https://www.example.com/oauth2/")) {
        const url = new URL(urlString, true);

        const providerName = url.pathname.split("/")[2];
        const loginProvider = loginProviders[providerName];
        const {code, state} = url.query;

        this.setState({loginProvider, code, state});
      }
    });
  }

  handleLogout = () => {
    this.setState({user: undefined});
  }

  handleLoginComplete = ({user}) => {
    this.setState({user, loginProvider: null})
  }

  handleLoginStart = ({loginProvider}) => {
    this.setState({loginProvider});
  }

  render() {
    const {user, loginProvider, code, state} = this.state;
    if (user) {
      return (
        <UserContext.Provider value={({user, onLogout: this.handleLogout})}>
          <UserContainer />
        </UserContext.Provider>);
    }

    if (loginProvider) {
      return <LoginComponent loginProvider={loginProvider} code={code} onLogin={this.handleLoginComplete} state={state}  />
    } else {
      return <WelcomeComponent onLogin={this.handleLoginStart} />
    }
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
