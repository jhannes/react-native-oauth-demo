const express = require('express');
const app = express();



app.get('/oauth2/:loginProvider/oauth2callback', (req, res) => {
    res.redirect('myoauth2app://myapp.com' + req.url);
});



app.listen(3000, () => console.log('Example app listening on port 3000!'))
