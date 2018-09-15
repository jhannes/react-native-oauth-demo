const express = require('express');
const app = express();
const fetch = require('node-fetch'); // npm install --save node-fetch
const qs = require('qs'); // npm install --save qs

const bodyParser = require('body-parser');
const device = require('express-device');
const exphbs  = require('express-handlebars');
const session = require('express-session');

app.use(bodyParser.urlencoded());
app.use(device.capture());
app.use(session({
    secret: "sdlf anfklnanalnklnsndgkln  a##PO%%"
}));
app.engine('handlebars', exphbs({defaultLayout: 'main'}));
app.set('view engine', 'handlebars');

const Config = require('./env');

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
})


app.get('/oauth2proxy/:loginProvider/oauth2callback', async (req, res) => {
    if (req.device == 'mobile') {
        return res.redirect('myoauth2app://myapp.com' + req.url);
    } else {
        const {loginProvider} = req.params;
        const {code} = req.query;

        const configuration = loginProviders[loginProvider];
        const {client_id, redirect_uri, grant_type, token_endpoint, client_secret} = configuration;
        const payload = qs.stringify({client_id, client_secret, code, redirect_uri, grant_type});
        console.log(payload);
    
        const response = await fetch(token_endpoint, {
            method: 'POST',
            headers: {
                'Content-type': 'application/x-www-form-urlencoded'
            },
            body: payload
        });
        const tokenResponse = await response.json();
        const id_token = JSON.parse(base64decode(tokenResponse.id_token.split('.')[1]));
        console.log(id_token);

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


const loginProviders = {
    // For configuration values, see https://accounts.google.com/.well-known/openid-configuration
    // For Administration, see https://console.developers.google.com/apis/credentials
    google: {
        title: "Google",
        client_id: Config.GOOGLE_CLIENT_ID,
        client_secret: Config.GOOGLE_CLIENT_SECRET,
        redirect_uri: Config.BACKEND + '/google/oauth2callback',
        authorization_endpoint: "https://accounts.google.com/o/oauth2/v2/auth",
        token_endpoint: 'https://accounts.google.com/o/oauth2/token',
        response_type: 'code',
        scope: 'profile email',
        grant_type: "authorization_code"
    },
    // For configuration values, see https://login.microsoftonline.com/common/.well-known/openid-configuration
    // For Administration, see https://portal.azure.com/#blade/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/RegisteredApps
    azure: {
        title: "Azure",
        client_id: Config.AZURE_CLIENT_ID,
        client_secret: Config.AZURE_CLIENT_SECRET,
        redirect_uri: Config.BACKEND + '/azure/oauth2callback',
        authorization_endpoint: "https://login.microsoftonline.com/common/oauth2/authorize",
        token_endpoint: 'https://login.microsoftonline.com/common/oauth2/token',
        response_type: 'code',
        scope: 'openid profile User.Read',
        grant_type: "authorization_code",
    },
    // For configuration, see https://difi.github.io/idporten-oidc-dokumentasjon/oidc_hvordan_komme_igang.html#well-known-endepunkt
    /// For setup instructions, see https://difi.github.io/idporten-oidc-dokumentasjon/oidc_func_clientreg.html
    idporten: {
        title: "ID-porten",
        client_id: Config.IDPORTEN_CLIENT_ID, // The Application ID of your Application Registration
        client_secret: Config.IDPORTEN_CLIENT_SECRET,
        redirect_uri: Config.BACKEND + '/idporten/oauth2callback',
        // IDPORTEN_AUTHORITY must match between app and server
        authorization_endpoint: Config.IDPORTEN_AUTHORITY + "/idporten-oidc-provider/authorize",
        token_endpoint: Config.IDPORTEN_AUTHORITY + '/idporten-oidc-provider/token',
        response_type: 'code',
        scope: 'openid profile',
        grant_type: "authorization_code",
    }
};

function base64decode(encoded) {
    return new Buffer(encoded, 'base64').toString('ascii');
}

app.post('/oauth2proxy/:loginProvider/token', (req, res) => {
    const {client_id, code, code_verifier, redirect_uri, grant_type} = req.body;
    const {loginProvider} = req.params;

    const configuration = loginProviders[loginProvider];
    const {token_endpoint, client_secret} = configuration;

    const payload = qs.stringify({client_id, client_secret, code, redirect_uri, code_verifier, grant_type});
    console.log(payload);

    fetch(token_endpoint, {
        method: 'POST',
        headers: {
            'Content-type': 'application/x-www-form-urlencoded'
        },
        body: payload
    }).then(response => {
        console.log(response.status);
        return response.json();
    }).then(tokenResponse => {
        console.log(tokenResponse);
        const id_token = JSON.parse(base64decode(tokenResponse.id_token.split('.')[1]));
        console.log(id_token);
        res.send({
            username: id_token.name || id_token.email || id_token.pid
        });
    }).catch(err => console.error);
});



app.listen(8084, () => console.log('Example app listening on port 8084!'))
