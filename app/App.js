import React from 'react';
import { StyleSheet, Text, View, Button } from 'react-native';
import { Linking, AsyncStorage } from 'react-native';


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

function storeCodeVerifier(code_verifier) {
  return AsyncStorage.setItem("code_verifier", code_verifier);
}

function retrieveCodeVerifier(code_verifier) {
  return AsyncStorage.getItem("code_verifier");
}

const idPorten = {
  name: "idPorten",
  authenticationUrl:  "http://10.0.2.2:3000/oauth2/idPorten/auth",
  token_url:          "http://10.0.2.2:3000/oauth2/idPorten/token",
  client_id: "abc-idPorten",
  redirect_uri: "https://www.example.com/oauth2/idPorten/oauth2callback"
};
const azureAd = {
  name: "azureAd",
  authenticationUrl:  "http://10.0.2.2:3000/oauth2/azureAd/auth",
  token_url:          "http://10.0.2.2:3000/oauth2/azureAd/token",
  client_id: "abc-azure",
  redirect_uri: "https://www.example.com/oauth2/azureAd/oauth2callback"
};
const dummyLogin = {
  name: "dummyLogin",
  authenticationUrl:  "http://10.0.2.2:3000/oauth2/dummyLogin/auth",
  token_url:          "http://10.0.2.2:3000/oauth2/dummyLogin/token",
  client_id: "abc-dummyLogin",
  redirect_uri: "https://www.example.com/oauth2/dummyLogin/oauth2callback"
};

function getCurrentUser() {
  return new Promise((resolve, reject) => {
    resolve();
  });
}

function loginUser({token_url, client_id, code, code_verifier}) {
  const url = token_url + "?" + qs({client_id, code, code_verifier});
  console.log(token_url);
  return fetch(token_url, {
    method: "POST",
    body: qs({client_id, code, code_verifier}) // TODO: Proper request
  }).then(res.json());
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
    const code_verifier = randomString();

    storeCodeVerifier(code_verifier).then(() => {
      const code_challenge_method = "plain"; // TODO: sha256
      const code_challenge = code_verifier;
      const {loginProvider} = this.props;
      const {authenticationUrl, client_id, redirect_uri} = loginProvider;
      const url = authenticationUrl + "?" + qs({client_id, code_challenge, code_challenge_method, redirect_uri});
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
    if (!this.state.user) {
      Linking.getInitialURL().then(url => {
        console.log({url});
  
        if (url && url.startsWith("https://www.example.com/oauth2/")) {
          // TODO: loginUser(url.query.code)
          retrieveCodeVerifier().then(code_verifier => {
            const code = "url.query.code";
            const {token_url, client_id} = idPorten;
            loginUser({token_url, client_id, code, code_verifier}).then(user => {
              this.setState({user});
            }).catch(e => {
              console.error(e);
            });
          });
        }
      });
    }
  }

  handleLogout = () => {
    this.setState({user: undefined});
  }

  handleLogin = ({loginProvider}) => {
    this.setState({loginProvider});
  }

  render() {
    const {user, loginProvider} = this.state;
    if (user) {
      return (
        <UserContext.Provider value={({user, onLogout: this.handleLogout})}>
          <UserContainer />
        </UserContext.Provider>);
    }

    if (loginProvider) {
      return <LoginComponent loginProvider={loginProvider} />
    } else {
      return <WelcomeComponent onLogin={this.handleLogin} />
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
