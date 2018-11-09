const express = require('express')
const app = express()
const bodyParser = require('body-parser')
const shortid = require('shortid');
const cors = require('cors')

const mongoose = require('mongoose')
mongoose.connect(process.env.MLAB_URI)

const Schema = mongoose.Schema;
const personSchema = new Schema({
  _id: {type: String, default: shortid.generate},
  username: {type: String, unique: true},
  log: [{
    description: {type: String, required: true},
    duration: {type: Number, required: true},
    date: Date
  }]
});
personSchema.post('save', function(error, doc, next) {
  if (error.name === 'MongoError' && error.code === 11000) {
    next(new Error('There was a duplicate key error'));
  } else {
    next();
  }
});

const Person = mongoose.model('Person', personSchema);

app.use(cors())

app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json())

app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

app.post("/api/exercise/new-user", function(req, res) {
  if (!req.body.username) {
    res.send("Please insert a username");
  } else {
    Person.create({username: req.body.username}, function(err, data) {
      if (err) {
        res.send(err.message);
      } else {
        res.json({_id: data._id, username: data.username});
      }
    });
  }
});

app.post("/api/exercise/add", function(req, res) {
  if (!req.body.userId || !req.body.description || !req.body.duration) {
    res.send("Please insert all required fields (userId, description, and duration)");
  } else {
    Person
      .findById(req.body.userId)
      .select("-__v")
      .exec(function(err, p) {
        if (err) {
          res.send("userId not found");
        } else {
          let exercise = {
            description: req.body.description,
            duration: req.body.duration,
          }
          if (req.body.date)
            exercise.date = req.body.date;
          p.log = [...p.log, exercise];
          p.save(function(err, data) {
            if (err) {
              res.send(err.message);
            } else {
              let response = {
                _id: p._id,
                username: p.username,
                description: exercise.description,
                duration: exercise.duration
              }
              if (exercise.date)
                response.date = exercise.date;
              res.json(response);
            }
          });
        }
      });
  }
});

app.get("/api/exercise/log", function(req, res) {
  if (!req.query.userId)
    return res.send("userId is required");
  Person
    .findById(req.query.userId)
    .select("-__v")
    .exec(function(err, p) {
      if (err) {
        res.send("userId not found");
      } else {
        res.json({
          _id: p._id,
          username: p.username,
          count: p.log.length,
          log: p.log.map(e => ({description: e.description, duration: e.duration, date: e.date.toDateString()}))
        });
      }
    });
});

// Not found middleware
app.use((req, res, next) => {
  return next({status: 404, message: 'not found'})
})

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage
  if (err.errors) {
    // mongoose validation error
    errCode = 400 // bad request
    const keys = Object.keys(err.errors)
    // report the first validation error
    errMessage = err.errors[keys[0]].message
  } else {
    // generic or custom error
    errCode = err.status || 500
    errMessage = err.message || 'Internal Server Error'
  }
  res.status(errCode).type('txt')
    .send(errMessage)
})

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
