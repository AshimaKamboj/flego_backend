const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const app = express();
const PORT = 5000;
const SECRET_KEY = 'your_secret_key';

// Connect to MongoDB
mongoose.connect('mongodb://127.0.0.1:27017/travel_blog')
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch((err) => console.error('❌ MongoDB connection error:', err));

// Schemas & Models
const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  role: { type: String, default: 'user' }
});
const User = mongoose.model('User', userSchema);

const bookingSchema = new mongoose.Schema({
  name: String,
  email: String,
  people: Number,
  city: String,
  price: String,
  date: { type: Date, default: Date.now }
});
const Booking = mongoose.model('Booking', bookingSchema);

const blogSchema = new mongoose.Schema({
  title: String,
  content: String,
  author: String,
  email: String,
  date: { type: Date, default: Date.now }
});
const Blog = mongoose.model('Blog', blogSchema);

// Middleware
app.use(cors());
app.use(express.json());

// JWT middleware
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: 'Missing token' });

  const token = authHeader.split(' ')[1];
  jwt.verify(token, SECRET_KEY, (err, decoded) => {
    if (err) return res.status(403).json({ message: 'Invalid token' });
    req.user = decoded;
    next();
  });
};

// ---------- AUTH ----------
app.post('/api/signup', async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: 'User already exists' });

    const newUser = new User({ name, email, password, role: role || 'user' });
    await newUser.save();

    res.status(201).json({ message: 'User registered successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error registering user' });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user || user.password !== password) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { name: user.name, email: user.email, role: user.role },
      SECRET_KEY,
      { expiresIn: '1h' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: { name: user.name, email: user.email, role: user.role }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error logging in' });
  }
});

// ---------- BOOKINGS ----------
app.get('/api/bookings', async (req, res) => {
  try {
    const bookings = await Booking.find();
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch bookings' });
  }
});

app.post('/api/bookings', authenticate, async (req, res) => {
  const { name, email, people, city, price } = req.body;
  if (!name || !email || !people || !city || !price) {
    return res.status(400).json({ message: 'All fields required' });
  }

  try {
    const newBooking = new Booking({ name, email, people, city, price });
    await newBooking.save();
    res.status(201).json({ message: 'Booking confirmed', booking: newBooking });
  } catch (err) {
    res.status(500).json({ message: 'Failed to save booking' });
  }
});

app.get('/api/admin/bookings', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied' });
  }

  try {
    const bookings = await Booking.find();
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching bookings' });
  }
});

app.delete('/api/admin/bookings/:id', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied' });
  }

  try {
    const deleted = await Booking.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    res.json({ message: 'Booking cancelled successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting booking' });
  }
});

// ---------- USERS (Admin Only) ----------
app.get('/api/admin/users', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied' });
  }

  try {
    const users = await User.find({}, '-password'); // Exclude password
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching users' });
  }
});

// ---------- BLOGS ----------
app.get('/api/blogs', async (req, res) => {
  try {
    const blogs = await Blog.find().sort({ date: -1 });
    res.json(blogs);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch blogs' });
  }
});

app.post('/api/blogs', authenticate, async (req, res) => {
  const { title, content } = req.body;
  if (!title || !content) {
    return res.status(400).json({ message: 'Title and content are required' });
  }

  try {
    const newBlog = new Blog({
      title,
      content,
      author: req.user.name,
      email: req.user.email
    });
    await newBlog.save();
    res.status(201).json({ message: 'Blog created', blog: newBlog });
  } catch (err) {
    res.status(500).json({ message: 'Error creating blog' });
  }
});

app.delete('/api/blogs/:id', authenticate, async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    if (!blog) return res.status(404).json({ message: 'Blog not found' });

    if (blog.email !== req.user.email && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to delete this blog' });
    }

    await Blog.findByIdAndDelete(req.params.id);
    res.json({ message: 'Blog deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting blog' });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
