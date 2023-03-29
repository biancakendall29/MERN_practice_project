const crypto = require('crypto');
const mongoose = require('mongoose');
const validator = require('validator');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please tell us your name'],
  },
  email: {
    type: String,
    required: [true, 'Please provide an email'],
    unique: true,
    lowercase: true,
    validate: [validator.isEmail, 'Please provide a valid email'],
  },
  photo: {
    type: String,
    default: 'default.jpg',
  },
  role: {
    type: String,
    enum: ['user', 'guide', 'lead-guide', 'admin'],
    default: 'user',
  },
  password: {
    type: String,
    required: [true, 'Please provide a password'],
    minLength: 8,
    select: false,
  },
  passwordConfirm: {
    type: String,
    required: [true, 'Please confirm your password'],
    validate: {
      // this only works on .create and .save !
      validator: function (el) {
        return el === this.password;
      },
      message: 'Passwords are not the same',
    },
  },
  passwordChangedAt: Date,
  passwordResetToken: String,
  passwordResetExpires: Date,
  active: {
    type: Boolean,
    default: true,
    select: false, // not show in output
  },
});

userSchema.pre('save', async function (next) {
  // Only run this function if password fieldwas actually modified
  if (!this.isModified('password')) return next();

  // encrypt/ hash the password with a cost of 12 (salts the password before hashing it)
  this.password = await bcrypt.hash(this.password, 12); // 12 is the 'cost' value (generates a salt - random string that makes hash unpredicatable)
  // 'cost' idicates how computational heavy this action will be (12 is current standard). Too high and the encryption process will take too long.

  // Delete password confirm field
  this.passwordConfirm = undefined; // only need it for inital validation, does not need to be persisted to database
  next();
});

userSchema.pre('save', function (next) {
  if (!this.isModified('password') || this.isNew) return next();

  this.passwordChangedAt = Date.now() - 1000; // ensures token is created after password has been changed
  next();
});

userSchema.pre(/^find/, function (next) {
  // this points to the current query
  this.find({ active: { $ne: false } });
  next();
});

// instance methods (available on all documents of a certain schema)
userSchema.methods.correctPassword = async function (
  candidatePassword,
  userPassword
) {
  // this.password not available in output since we deselected it
  return await bcrypt.compare(candidatePassword, userPassword);
};

userSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimeStamp = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10
    ); // get in same time format as JWTTimeStamp
    return JWTTimestamp < changedTimeStamp; // returns true if password was changed after token was issued
  }
  return false;
};

userSchema.methods.createPasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString('hex');

  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  console.log({ resetToken }, this.passwordResetToken);

  this.passwordResetExpires = Date.now() + 10 * 60 * 1000; // add 10 minutes

  return resetToken;
};

const User = mongoose.model('User', userSchema);

module.exports = User;
