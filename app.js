const path = require('path');
const express = require('express');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const cookieParser = require('cookie-parser');
const compression = require('compression');

const AppError = require('./utils/appError');
const globalErrorHandler = require('./controllers/errorController');
const tourRouter = require('./routes/tourRoutes');
const userRouter = require('./routes/userRoutes');
const reviewRouter = require('./routes/reviewRoutes');
const bookingRouter = require('./routes/bookingRoutes');
const viewRouter = require('./routes/viewRoutes');

const app = express();

app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));

// 1) GLOBAL MIDDLEWARES

// Serving static files
// append static file name (eg. overview.html or pin.png) to end of url and this middleware allows it to display
app.use(express.static(path.join(__dirname, 'public')));

// Set security HTTP headers
app.use(helmet());
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "script-src 'self' https://cdnjs.cloudflare.com https://js.stripe.com/v3/"
  );
  next();
});

// Development logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Limit requests from same API
const limiter = rateLimit({
  max: 100, // allows only 100 requests
  window: 60 * 60 * 1000, // in 1 hour (from the same IP address)
  message: 'Too many requests from this IP, please try again in an hour!',
});
app.use('/api', limiter); // apply limiter to all requests (that contain /api in url)

// Body parser, reading data from body into req.body
app.use(express.json({ limit: '10kb' })); // when we have a body larger than 10kb it will not be accepted
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());

// Data sanitisation against NoSQL query injection
app.use(mongoSanitize()); // filters out doller signs and dots in request body to prevent these attacks (attacks done with mongo queries like {$gt})

// Data sanitisation against XSS (cross-site scripting attacks)
app.use(xss()); // clean any user input from malicious html code (eg. someone adding html to json)

// Prevent parameter pollution (eg. 2 sort queries in url)
app.use(
  hpp({
    whitelist: [
      'duration',
      'ratingsQuantity',
      'ratingsAverage',
      'maxGroupSize',
      'difficulty',
      'price',
    ], // array of properties for which we allow duplicates in the query string
  })
);

app.use(compression());

// our own middleware function
// applies to every single request: get/post etc, any url
// is applied in the order that code is written, so should appear before any route handling
// app.use((req, res, next) => {
//   console.log('Hi from middleware stack');
//   next(); // must always call next at the end of a middleware function
// });

// Test middleware
app.use((req, res, next) => {
  req.requestTime = new Date().toISOString();
  next();
});

// 2) ROUTE HANDLERS

// in separate files

// 3) ROUTES
// mounting the routers (using middleware)
app.use('/', viewRouter);
app.use('/api/v1/tours', tourRouter);
app.use('/api/v1/users', userRouter);
app.use('/api/v1/reviews', reviewRouter);
app.use('/api/v1/bookings', bookingRouter);

// route handler function to catch when a url endpoint has not been defined
// middleware occues in order it is defined, so this only gets executed one all other routes have been run (and are not found)
app.all('*', (req, res, next) => {
  // res.status(404).json({
  //   status: 'fail',
  //   message: `Can't find ${req.originalUrl} on this server`,
  // });
  // const err = new Error(`Can't find ${req.originalUrl} on this server`);
  // err.status = 'fail';
  // err.statusCode = 404;

  // next(err); // passing anything into next is it assumed it is an error and it will skip all other middlewares in the stack and go to the global error handling middleware
  next(new AppError(`Can't find ${req.originalUrl} on this server`, 404));
}); // .all handles all the http methods: get, update etc.

// GLOBAL ERROR HANDLING MIDDLEWARE
// by specifying 4 arguments, express knows its an error handling middleware
// app.use((err, req, res, next) => {
//   console.log(err.stack);
//   err.statusCode = err.statusCode || 500; // 500 internal server error is default
//   err.status = err.status || 'error';

//   res.status(err.statusCode).json({
//     status: err.status,
//     message: err.message,
//   });
// });
app.use(globalErrorHandler);

// 4) SERVER
// in separate file

module.exports = app;
