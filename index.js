const mongoose = require('mongoose');
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo')(session);
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth').OAuth2Strategy;

require('dotenv').config();

// database

mongoose.connect('mongodb://localhost:27017/google-session', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const User = mongoose.model('User', {
  username: String,
  googleId: String,
  admin: Boolean,
});

// General setup

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Sessions

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    saveUninitialized: true,
    resave: false,
    store: new MongoStore({ mongooseConnection: mongoose.connection }),
    cookie: {
      maxAge: 1000 * 60 * 60 * 24, // 1 day
    },
  })
);

// Passport Setup

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_KEY,
      clientSecret: process.env.GOOGLE_SECRET,
      callbackURL: '/auth/google/callback',
    },
    async (accessToken, refreshToken, profile, done) => {
      // console.log(accessToken);
      try {
        const user =
          (await User.findOne({ googleId: profile.id }).exec()) ||
          (await new User({
            username: profile.displayName,
            googleId: profile.id,
          }).save());
        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }
  )
);

// store user id to sessions.passport.user
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// restored user to req.user from sessions.passport.user
passport.deserializeUser((id, done) => {
  User.findById(id, (err, user) => {
    done(err, user);
  });
});

app.use(passport.initialize());
app.use(passport.session());

// Routes

app.get(
  '/auth/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
  })
);

app.get(
  '/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/' }),
  (req, res) => {
    res.redirect('/');
  }
);

app.get('/', (req, res, next) => {
  // console.log(req.session);
  if (req.isAuthenticated()) {
    res.send(`Hi, ${req.user.username}. <a href="/logout">logout</a>`);
  } else {
    res.send('please <a href="/auth/google">login</a> first');
  }
});

app.get('/logout', (req, res, next) => {
  req.logOut();
  res.redirect('/');
});

// Server
app.listen(8080);

// https://dev.to/phyllis_yym/beginner-s-guide-to-google-oauth-with-passport-js-2gh4
// https://www.youtube.com/playlist?list=PLYQSCk-qyTW2ewJ05f_GKHtTIzjynDgjK
