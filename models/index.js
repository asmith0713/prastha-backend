
// // working
// import mongoose from 'mongoose';
// import bcrypt from 'bcrypt';

// // User Schema
// const userSchema = new mongoose.Schema({
//   username: {
//     type: String,
//     required: true,
//     unique: true,
//     trim: true,
//     maxlength: 50
//   },
//   password: {
//     type: String,
//     required: true,
//     minlength: 6
//   },
//   email: {
//     type: String,
//     trim: true,
//     lowercase: true
//   },
//   isAdmin: {
//     type: Boolean,
//     default: false
//   }
// }, {
//   timestamps: true
// });

// // Hash password before saving
// userSchema.pre('save', async function(next) {
//   if (!this.isModified('password')) return next();
  
//   try {
//     const salt = await bcrypt.genSalt(10);
//     this.password = await bcrypt.hash(this.password, salt);
//     next();
//   } catch (error) {
//     next(error);
//   }
// });

// // Method to compare password
// userSchema.methods.comparePassword = async function(candidatePassword) {
//   return await bcrypt.compare(candidatePassword, this.password);
// };

// // Thread Schema
// const threadSchema = new mongoose.Schema({
//   title: {
//     type: String,
//     required: true,
//     trim: true,
//     maxlength: 200
//   },
//   description: {
//     type: String,
//     required: true,
//     trim: true
//   },
//   creator: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User',
//     required: true
//   },
//   creatorUsername: {
//     type: String,
//     required: true
//   },
//   location: {
//     type: String,
//     required: true,
//     trim: true,
//     maxlength: 200
//   },
//   tags: [{
//     type: String,
//     trim: true
//   }],
//   members: [{
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User'
//   }],
//   pendingRequests: [{
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User'
//   }],
//   expiresAt: {
//     type: Date,
//     required: true,
//     index: { expires: 0 }
//   }
// }, {
//   timestamps: true
// });

// // Message Schema
// const messageSchema = new mongoose.Schema({
//   threadId: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'Thread',
//     required: true
//   },
//   userId: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User',
//     required: true
//   },
//   username: {
//     type: String,
//     required: true
//   },
//   message: {
//     type: String,
//     required: true,
//     trim: true
//   },
//   timestamp: {
//     type: Date,
//     default: Date.now
//   }
// });

// // Gossip Schema
// const gossipSchema = new mongoose.Schema({
//   content: {
//     type: String,
//     required: true,
//     trim: true,
//     maxlength: 500
//   },
//   author: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User',
//     required: true
//   },
//   authorUsername: {
//     type: String,
//     required: true
//   },
//   isAnonymous: {
//     type: Boolean,
//     default: false
//   },
//   upvotedBy: [{
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User'
//   }],
//   downvotedBy: [{
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User'
//   }],
//   lastActivity: {
//     type: Date,
//     default: Date.now
//   },
//   expiresAt: {
//     type: Date,
//     default: () => new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
//     index: { expires: 0 } // TTL index - auto-delete after expiresAt
//   }
// }, {
//   timestamps: true
// });

// // Update lastActivity when votes or comments are added
// gossipSchema.methods.updateActivity = function() {
//   this.lastActivity = new Date();
//   this.expiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
//   return this.save();
// };

// // Gossip Comment Schema - UPDATED for Reddit-style threaded comments
// const gossipCommentSchema = new mongoose.Schema({
//   gossipId: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'Gossip',
//     required: true
//   },
//   content: {
//     type: String,
//     required: true,
//     trim: true,
//     maxlength: 300
//   },
//   author: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User',
//     required: true
//   },
//   authorUsername: {
//     type: String,
//     required: true
//   },
//   isAnonymous: {
//     type: Boolean,
//     default: false
//   },
//   // NEW FIELDS for Reddit-style threaded comments
//   parentCommentId: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'GossipComment',
//     default: null
//   },
//   replyTo: {
//     type: String, // Username being replied to
//     default: null
//   }
// }, {
//   timestamps: true
// });

// // Indexes for performance
// userSchema.index({ username: 1 });
// threadSchema.index({ creator: 1 });
// threadSchema.index({ expiresAt: 1 });
// threadSchema.index({ createdAt: -1 });
// messageSchema.index({ threadId: 1, timestamp: -1 });
// gossipSchema.index({ createdAt: -1 });
// gossipCommentSchema.index({ gossipId: 1, createdAt: -1 });
// // NEW INDEXES for threaded comments
// gossipCommentSchema.index({ gossipId: 1, parentCommentId: 1 });

// // Models
// const User = mongoose.model('User', userSchema);
// const Thread = mongoose.model('Thread', threadSchema);
// const Message = mongoose.model('Message', messageSchema);
// const Gossip = mongoose.model('Gossip', gossipSchema);
// const GossipComment = mongoose.model('GossipComment', gossipCommentSchema);

// export { User, Thread, Message, Gossip, GossipComment };  

import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

// User Schema - NO EMAIL REQUIRED
const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    maxlength: 50
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    default: null
  },
  isAdmin: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

const threadSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    required: false,
    trim: true,
    default: ''
  },
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  creatorUsername: {
    type: String,
    required: true
  },
  location: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  tags: [{
    type: String,
    trim: true
  }],
  members: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  pendingRequests: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  expiresAt: {
    type: Date,
    required: true,
    index: { expires: 0 }
  }
}, {
  timestamps: true
});

const messageSchema = new mongoose.Schema({
  threadId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Thread',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  username: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true,
    trim: true
  },
  replyToMessageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    default: null
  },
  replyToUser: {
    type: String,
    default: null
  },
  replyPreview: {
    type: String,
    default: null,
    maxlength: 300
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const gossipSchema = new mongoose.Schema({
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  authorUsername: {
    type: String,
    required: true
  },
  isAnonymous: {
    type: Boolean,
    default: false
  },
  upvotedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  downvotedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  lastActivity: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    index: { expires: 0 }
  }
}, {
  timestamps: true
});

gossipSchema.methods.updateActivity = function() {
  this.lastActivity = new Date();
  this.expiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  return this.save();
};

const gossipCommentSchema = new mongoose.Schema({
  gossipId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Gossip',
    required: true
  },
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: 300
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  authorUsername: {
    type: String,
    required: true
  },
  isAnonymous: {
    type: Boolean,
    default: false
  },
  parentCommentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'GossipComment',
    default: null
  },
  replyTo: {
    type: String,
    default: null
  },
  upvotedBy: {
    type: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    default: []
  },
  downvotedBy: {
    type: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    default: []
  }
}, {
  timestamps: true
});

const commentReportSchema = new mongoose.Schema({
  gossipId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Gossip',
    required: true
  },
  commentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'GossipComment',
    required: true
  },
  commentContent: {
    type: String,
    required: true
  },
  commentAuthor: {
    type: String,
    required: true
  },
  commentAuthorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reporter: {
    type: String,
    required: true
  },
  reporterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reason: {
    type: String,
    default: 'Inappropriate content'
  },
  status: {
    type: String,
    enum: ['pending', 'reviewed', 'dismissed', 'action-taken'],
    default: 'pending'
  },
  adminNotes: {
    type: String,
    default: ''
  },
  reviewedBy: {
    type: String,
    default: null
  },
  reviewedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

userSchema.index({ username: 1 });
threadSchema.index({ creator: 1 });
threadSchema.index({ expiresAt: 1 });
threadSchema.index({ createdAt: -1 });
messageSchema.index({ threadId: 1, timestamp: -1 });
gossipSchema.index({ createdAt: -1 });
gossipCommentSchema.index({ gossipId: 1, createdAt: -1 });
gossipCommentSchema.index({ gossipId: 1, parentCommentId: 1 });
commentReportSchema.index({ status: 1, createdAt: -1 });
commentReportSchema.index({ commentId: 1 });

const User = mongoose.model('User', userSchema);
const Thread = mongoose.model('Thread', threadSchema);
const Message = mongoose.model('Message', messageSchema);
const Gossip = mongoose.model('Gossip', gossipSchema);
const GossipComment = mongoose.model('GossipComment', gossipCommentSchema);
const CommentReport = mongoose.model('CommentReport', commentReportSchema);

export { User, Thread, Message, Gossip, GossipComment, CommentReport };