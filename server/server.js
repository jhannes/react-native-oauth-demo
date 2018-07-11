const express = require('express')
const app = express()

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

app.get('/', (req, res) => res.send('Hello World!'))
app.use(express.static('public'))


app.get('/oauth2/idPorten/auth', (req, res) => {
    console.log(req.query);
    const code = randomString();
    const returnUrl = req.query.redirect_uri + "?" + qs({code});
    res.redirect(returnUrl);
});

app.post('/oauth2/idPorten/token', (req, res) => {
    console.log(req.body);
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify({name: "My User Name"}));
});


app.listen(3000, () => console.log('Example app listening on port 3000!'))
