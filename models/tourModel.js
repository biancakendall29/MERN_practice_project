const mongoose = require('mongoose');
const slugify = require('slugify');
// const User = require('./userModel');
// const validator = require('validator');

const tourSchema = new mongoose.Schema(
  // {schema object}, {schema options}
  {
    name: {
      type: String,
      required: [true, 'A tour must have a name'],
      unique: true,
      trim: true,
      // built-in validators
      // only for strings
      maxlength: [40, 'A tour name must have less or equal than 40 characters'],
      minlength: [10, 'A tour name must have more or equal than 10 characters'],
      // validator library (jsut for demo as it exludes spaces)
      // validate: [validator.isAlpha, 'A tour name must only contain characters'],
    },
    slug: String,
    duration: {
      type: Number,
      required: [true, 'A tour must have a duration'],
    },
    maxGroupSize: {
      type: Number,
      required: [true, 'A tour must have a group size'],
    },
    difficulty: {
      type: String,
      required: [true, 'A tour must have a difficulty'],
      // built-in validators
      enum: {
        // only for strings
        values: ['easy', 'medium', 'difficult'],
        message: 'Difficulty is either: easy, medium, difficult',
      },
    },
    ratingsAverage: {
      type: Number,
      default: 4.5,
      // built-in validators
      // for numbers and dates
      min: [1, 'Rating must be above 1.0'],
      max: [5, 'Rating must be below 5.0'],
      set: (val) => Math.round(val * 10) / 10, // to get 4.666 -> 4.7
    },
    ratingsQuantity: {
      type: Number,
      default: 0,
    },
    price: {
      type: Number,
      required: [true, 'A tour must have a price'],
    },
    priceDiscount: {
      type: Number,
      validate: {
        // custom validator: has callback function which has access to value input: price discount
        validator: function (val) {
          // this only points to current doc on NEW document creation
          // will only work on create method, not update
          return val < this.price; // price discount should be lower than price -> return true
        },
        message: 'Discount price ({VALUE}) should be below the regular price',
      },
    },
    summary: {
      type: String,
      trim: true, // removes all whitespace at beginning and end of string
      required: [true, 'A tour must have a summary'],
    },
    description: {
      type: String,
      trim: true,
    },
    imageCover: {
      type: String,
      required: [true, 'A tour must have a cover image'],
    },
    images: [String],
    createdAt: {
      type: Date,
      default: Date.now(),
      select: false, // will not be displayed in ouput, hidden from client
    },
    startDates: [Date],
    secretTour: {
      type: Boolean,
      default: false,
    },
    // embedded datasets
    startLocation: {
      // GeoJSON
      // we need schema options for type and coordinates
      type: {
        type: String,
        default: 'Point',
        enum: ['Point'], // we only want point to be the geo spatial type
      },
      coordinates: [Number], // order: latitude, longitude
      address: String,
      description: String,
    },
    locations: [
      {
        type: {
          type: String,
          default: 'Point',
          enum: ['Point'],
        },
        coordinates: [Number],
        address: String,
        description: String,
        day: Number,
      },
    ],
    // embedding user into tours method:
    // guides: Array,
    // referencing method:
    guides: [
      {
        type: mongoose.Schema.ObjectId,
        ref: 'User', // create reference to another model
      },
    ],
  },
  // schema options
  {
    toJSON: { virtuals: true }, // when output is json, show virtual properties
    toObject: { virtuals: true },
  }
);

// tourSchema.index({ price: 1 });
tourSchema.index({ price: 1, ratingsAverage: -1 }); // compound index. 1 for ascending order and -1 for descending
tourSchema.index({ slug: 1 });
tourSchema.index({ startLocation: '2dsphere' });

// virtual properties - don't want to be persisted to database, to save space. Usually a mathematical conversion
tourSchema.virtual('durationWeeks').get(function () {
  return this.duration / 7; // need this keyword to point to current document. that is why we need regular function
});

// Virtual populate - keeps records of child documents on parent, without actually persisting to database
tourSchema.virtual('reviews', {
  ref: 'Review',
  foreignField: 'tour', // name of field in review modal where tour id is stored
  localField: '_id', // name of field in tour model to connect to
});

// DOCUMENT MIDDLEWARE: runs before the .save() command and .create() (not update)
// pre-middleware functions
// can act on data before it is saved to database
tourSchema.pre('save', function (next) {
  this.slug = slugify(this.name, { lower: true });
  next();
});

// for embedding user documents into tours - worse in this case than referencing
// tourSchema.pre('save', async function (next) {
//   const guidesPromises = this.guides.map(async (id) => await User.findById(id));
//   this.guides = await Promise.all(guidesPromises);
//   next();
// });

// post middleware functions: runs after you save doc to database. Has access to document being currently saved
// tourSchema.post('save', function (doc, next) {
//   console.log(doc);
//   next();
// });

// QUERY MIDDLEWARE: 'this' keyword will point to current query and not current document
// pre-middelware
tourSchema.pre(/^find/, function (next) {
  // regular expression: all string that start with 'find': findOne, find, findOneAndDelete etc.
  this.find({ secretTour: { $ne: true } }); // filters out secret tours when a find query is sent
  this.start = Date.now();
  next();
});

tourSchema.pre(/^find/, function (next) {
  // populate shows the whole user document and not just the id, for the request
  this.populate({
    path: 'guides',
    select: '-__v -passwordChangedAt', // remove these from displaying
  });
  next();
});

// post middleware: runs after query has finished
// tourSchema.post(/^find/, function (docs, next) {
//   console.log(`Query took ${Date.now() - this.start} milliseconds`);
//   //   console.log(docs);
//   next();
// });

// AGGREGATION MIDDLEWARE: adds hooks before and after aggregation happens
// 'this' keyword points to current aggregation object
// tourSchema.pre('aggregate', function (next) {
//   // adds to beginning of aggregate array
//   this.pipeline().unshift({ $match: { secretTour: { $ne: true } } });
//   //   console.log(this.pipeline());
//   next();
// });

// mongoose convention, models have capital letters
const Tour = mongoose.model('Tour', tourSchema);

module.exports = Tour;
