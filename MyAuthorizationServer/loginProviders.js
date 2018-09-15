const Config = require('./env');

module.exports = {
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
