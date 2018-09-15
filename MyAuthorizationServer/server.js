const express = require('express');
const app = express();
const fetch = require('node-fetch'); // npm install --save node-fetch
const qs = require('qs'); // npm install --save qs

const bodyParser = require('body-parser');
const device = require('express-device');
const exphbs  = require('express-handlebars');
const session = require('express-session');

const loginProviders = require('./loginProviders');

app.use(bodyParser.urlencoded());
app.use(device.capture());
app.use(session({
    secret: "sdlf anfklnanalnklnsndgkln  a##PO%%"
}));
app.engine('handlebars', exphbs({defaultLayout: 'main'}));
app.set('view engine', 'handlebars');


function base64decode(encoded) {
    return new Buffer(encoded, 'base64').toString('ascii');
}

function postForm(url, formData) {
    const payload = qs.stringify(formData);
    console.log(payload);
    
    return fetch(url, {
        method: 'POST',
        headers: {
            'Content-type': 'application/x-www-form-urlencoded'
        },
        body: payload
    });
}


function authorization_url({authorization_endpoint, redirect_uri, client_id, response_type, scope}) {
    const params = {client_id, redirect_uri, response_type, scope};
    return authorization_endpoint + "?" + qs.stringify(params);
}

app.get('/', (req, res) => {
    console.log(req.session.logins);

    const providers = Object.values(loginProviders).map((loginProvider) => ({
        title: loginProvider.title,
        authorization_url: authorization_url(loginProvider)
    }));
    const logins = Object.values(req.session.logins || {}).map(login => ({
        name: login.name || login.email || login.pid,
        id: login.upn || login.email || login.pid,
        authority: login.tid || login.iss
    }));

    res.render("index", {
        providers, logins
    });
});

app.get('/oauth2proxy/:loginProvider/oauth2callback', async (req, res) => {
    if (req.device == 'mobile') {
        return res.redirect('myoauth2app://myapp.com' + req.url);
    } else {
        const {loginProvider} = req.params;
        const {code} = req.query;

        const configuration = loginProviders[loginProvider];
        const {client_id, redirect_uri, grant_type, token_endpoint, client_secret} = configuration;
    
        const response = await postForm(token_endpoint,
            {client_id, client_secret, code, redirect_uri, grant_type});
        const tokenResponse = await response.json();
        console.log(tokenResponse);
        const id_token = JSON.parse(base64decode(tokenResponse.id_token.split('.')[1]));

        if (!req.session.logins) {
            req.session.regenerate(() => {
                req.session.logins = {};
                req.session.logins[loginProvider] = id_token
                res.redirect("/");
            });
        } else {
            req.session.logins[loginProvider] = id_token
            res.redirect("/");
        }
    }
});


app.post('/oauth2proxy/:loginProvider/token', async (req, res) => {
    const {client_id, code, code_verifier, redirect_uri, grant_type} = req.body;
    const {loginProvider} = req.params;

    const configuration = loginProviders[loginProvider];
    const {token_endpoint, client_secret} = configuration;

    const response = await postForm(token_endpoint,
        {client_id, client_secret, code, redirect_uri, code_verifier, grant_type});
    const tokenResponse = await response.json();
    console.log(tokenResponse);
    const id_token = JSON.parse(base64decode(tokenResponse.id_token.split('.')[1]));
    res.send({
        username: id_token.name || id_token.email || id_token.pid
    });
});


app.listen(8084, () => console.log('Example app listening on port 8084!'))
