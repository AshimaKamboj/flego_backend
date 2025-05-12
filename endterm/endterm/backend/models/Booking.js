const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  people: { type: Number, required: true },
  city: { type: String, required: true },
  price: { type: String, required: true },
  user: { type: String, required: true },  // To associate with the user
  date: { type: Date, default: Date.now },
});

const Booking = mongoose.model('Booking', bookingSchema);

module.exports = Booking;
