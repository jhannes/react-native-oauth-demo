const express = require('express')
const app = express()
const randomstring = require('randomstring');
const URL = require('url-parse');
const bodyParser = require('body-parser');
const hash = require('hash.js');

const idPorten = {
  name: "idPorten",
  token_url: "https://oidc-ver2.difi.no/idporten-oidc-provider/authorize",
  client_id: "abc-idPorten",
  client_secret: ""
};
const azureAd = {
  name: "azureAd",
  token_url:  "https://login.microsoft.com/common/oauth2/token",
  client_id: "abc-azure",
  client_secret: ""
};

const loginProviders = {
  idPorten, azureAd
};



function qs(obj) {
  const params = [];
  for (const p in obj) {
    if (obj.hasOwnProperty(p)) {
      params.push(encodeURIComponent(p) + "=" + encodeURIComponent(obj[p]));
    }
  }
  return params.join("&");
}

app.get('/', (req, res) => res.send('Hello World!'))
app.use(express.static('public'));
app.use(bodyParser.urlencoded())

var authorizations = new Map();


app.get('/oauth2/:loginProvider/auth', (req, res) => {
    const {code_challenge, client_id, redirect_uri, state} = req.query;
    const code = randomstring.generate();
    const {loginProvider} = req.params;

    authorizations[code] = {
      code, code_challenge, client_id, loginProvider
    }

    const returnUrl = redirect_uri + "?" + qs({code, state});
    res.redirect(returnUrl);
});

app.post('/oauth2/:loginProvider/token', (req, res) => {
    console.log(req.body);
    const {code, code_verifier, response_uri} = req.body;
    const {loginProvider} = req.params;

    if (loginProvider === "dummyLogin") {
      const authorization = authorizations[code];

      res.setHeader('Content-Type', 'application/json');
      if (!authorization) {
        return res.send(400, JSON.stringify({error: 'invalid code'}));
      } else if (authorization.code_challenge != hash.sha256().update(code_verifier).digest('hex')) {
        res.send(400, JSON.stringify({error: 'invalid code_verifier'}));
      } else if (authorization.loginProvider != loginProvider) {
        return res.send(400, JSON.stringify({error: 'Wrong login provider'}));
      }
  
      res.send(JSON.stringify({name: "My User Name"}));
      authorizations.delete(code);  
    } else {
      // The following code is untested due to network issues!
      const configuration = loginProviders[loginProvider];
      const {token_url, client_secret} = configuration;

      fetch(token_url, {
        method: "POST",
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: qs({client_id, client_secret, code, code_verifier, response_uri})
      }).then(response => {
        res.send(response.code, response.body);
      });
    }
});


app.listen(3000, () => console.log('Example app listening on port 3000!'))
