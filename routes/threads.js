import express from 'express';
import { Thread, Message, User } from '../models/index.js';

const router = express.Router();

const hydrateThread = async (thread) => {
  if (!thread) return null;

  const messages = await Message.find({ threadId: thread._id })
    .sort({ timestamp: 1 })
    .lean();

  return {
    id: thread._id.toString(),
    title: thread.title,
    description: thread.description,
    creator: thread.creatorUsername,
    creatorId: thread.creator.toString(),
    location: thread.location,
    tags: thread.tags,
    expiresAt: thread.expiresAt.toISOString(),
    members: (thread.members || []).map((member) => member.toString()),
    pendingRequests: (thread.pendingRequests || []).map((request) => request.toString()),
    chat: messages.map((msg) => ({
      id: msg._id.toString(),
      user: msg.username,
      userId: msg.userId.toString(),
      message: msg.message,
      timestamp: msg.timestamp.toISOString(),
      replyToMessageId: msg.replyToMessageId ? msg.replyToMessageId.toString() : null,
      replyToUser: msg.replyToUser ?? null,
      replyPreview: msg.replyPreview ?? null
    })),
    createdAt: thread.createdAt.toISOString()
  };
};

// GET /api/threads - Get all active threads
router.get('/', async (req, res) => {
  try {
    console.log('\n📋 FETCHING ALL ACTIVE THREADS...');
    
    const threads = await Thread.find({
      expiresAt: { $gt: new Date() }
    })
    .sort({ createdAt: -1 })
    .lean();

    console.log(`📊 FOUND ${threads.length} ACTIVE THREADS`);

    const threadsWithMessages = await Promise.all(threads.map(hydrateThread));

    res.json({ success: true, threads: threadsWithMessages });
  } catch (error) {
    console.error('❌ GET THREADS ERROR:', error);
    res.status(500).json({ success: false, message: 'Error fetching threads' });
  }
});

// GET /api/threads/user/:userId - Summary + lists for profile views
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const userThreads = await Thread.find({
      $or: [{ creator: userId }, { members: userId }]
    })
      .sort({ createdAt: -1 })
      .lean();

    const hydratedThreads = (await Promise.all(userThreads.map(hydrateThread))).filter(Boolean);

    const createdThreads = hydratedThreads.filter((thread) => thread.creatorId === userId);
    const joinedThreads = hydratedThreads.filter(
      (thread) => thread.creatorId !== userId && thread.members.includes(userId)
    );

    const stats = {
      created: createdThreads.length,
      joined: joinedThreads.length,
      impact: createdThreads.reduce((total, thread) => total + (thread.members?.length ?? 0), 0)
    };

    res.json({
      success: true,
      stats,
      createdThreads,
      joinedThreads
    });
  } catch (error) {
    console.error('❌ USER THREADS ERROR:', error);
    res.status(500).json({ success: false, message: 'Error fetching user threads' });
  }
});

// GET /api/threads/alerts/:userId - Alert feed for a user
router.get('/alerts/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const joinedThreads = await Thread.find({ members: userId })
      .sort({ expiresAt: 1 })
      .lean();

    const hydratedThreads = (await Promise.all(joinedThreads.map(hydrateThread))).filter(Boolean);
    const now = Date.now();

    const alerts = hydratedThreads.map((thread) => {
      const expiresAt = new Date(thread.expiresAt).getTime();
      const hoursUntilExpiry = (expiresAt - now) / (1000 * 60 * 60);
      const type = hoursUntilExpiry <= 1 ? 'urgent' : hoursUntilExpiry <= 4 ? 'soon' : 'scheduled';

      return {
        id: thread.id,
        title: thread.title,
        message: `Heads up! ${thread.title} kicks off soon at ${thread.location}.`,
        time: thread.expiresAt,
        type,
        location: thread.location,
        thread
      };
    });

    res.json({ success: true, alerts });
  } catch (error) {
    console.error('❌ THREAD ALERTS ERROR:', error);
    res.status(500).json({ success: false, message: 'Error fetching alerts' });
  }
});

// POST /api/threads - Create new thread
router.post('/', async (req, res) => {
  try {
    const { title, description, creator, creatorId, location, tags, expiresAt } = req.body;
    const normalizedDescription = (description ?? '').trim();

    console.log('\n🎯 CREATING NEW THREAD...');

    const thread = new Thread({
      title,
      description: normalizedDescription,
      creator: creatorId,
      creatorUsername: creator,
      location,
      tags,
      members: [creatorId],
      pendingRequests: [],
      expiresAt: new Date(expiresAt)
    });

    await thread.save();
    console.log(`✅ THREAD CREATED | ID: ${thread._id}`);

    const welcomeMessage = new Message({
      threadId: thread._id,
      userId: creatorId,
      username: creator,
      message: 'Thread created! Welcome everyone 👋'
    });
    await welcomeMessage.save();

    // Emit socket event to refresh all threads
    const io = req.app.get('io');
    io.emit('refresh-threads');

    res.status(201).json({
      success: true,
      thread: {
        id: thread._id.toString(),
        title: thread.title,
        description: thread.description,
        creator: thread.creatorUsername,
        creatorId: thread.creator.toString(),
        location: thread.location,
        tags: thread.tags,
        expiresAt: thread.expiresAt.toISOString(),
        members: [creatorId],
        pendingRequests: [],
        chat: [{
          id: welcomeMessage._id.toString(),
          user: creator,
          userId: creatorId,
          message: 'Thread created! Welcome everyone 👋',
          timestamp: welcomeMessage.timestamp.toISOString(),
          replyToMessageId: null,
          replyToUser: null,
          replyPreview: null
        }],
        createdAt: thread.createdAt.toISOString()
      }
    });
  } catch (error) {
    console.error('❌ CREATE THREAD ERROR:', error);
    res.status(500).json({ success: false, message: 'Error creating thread' });
  }
});

// POST /api/threads/:id/messages - Send chat message inside a thread
router.post('/:id/messages', async (req, res) => {
  try {
    const { id } = req.params;
    const { user, userId, message, replyToMessageId, replyToUser, replyPreview } = req.body;

    if (!message?.trim()) {
      return res.status(400).json({ success: false, message: 'Message content required' });
    }

    const thread = await Thread.findById(id);
    if (!thread) {
      return res.status(404).json({ success: false, message: 'Thread not found' });
    }

    const newMessage = new Message({
      threadId: id,
      userId,
      username: user,
      message: message.trim(),
      replyToMessageId: replyToMessageId || null,
      replyToUser: replyToUser || null,
      replyPreview: replyPreview || null
    });

    await newMessage.save();

    const payload = {
      id: newMessage._id.toString(),
      user: newMessage.username,
      userId: newMessage.userId.toString(),
      message: newMessage.message,
      timestamp: newMessage.timestamp.toISOString(),
      replyToMessageId: newMessage.replyToMessageId ? newMessage.replyToMessageId.toString() : null,
      replyToUser: newMessage.replyToUser,
      replyPreview: newMessage.replyPreview
    };

    const io = req.app.get('io');
    io.to(id).emit('new-message', payload);

    res.status(201).json({ success: true, message: payload });
  } catch (error) {
    console.error('❌ SEND MESSAGE ERROR:', error);
    res.status(500).json({ success: false, message: 'Error sending message' });
  }
});

// PUT /api/threads/:id - Update thread
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, location, tags, userId } = req.body;

    const thread = await Thread.findById(id);
    if (!thread) {
      return res.status(404).json({ success: false, message: 'Thread not found' });
    }

    if (thread.creator.toString() !== userId) {
      return res.status(403).json({ 
        success: false, 
        message: 'Only thread creator can update' 
      });
    }

    thread.title = title;
    thread.description = description;
    thread.location = location;
    thread.tags = tags;
    
    await thread.save();

    // Emit socket event
    const io = req.app.get('io');
    io.emit('refresh-threads');

    res.json({
      success: true,
      message: 'Thread updated successfully'
    });
  } catch (error) {
    console.error('❌ UPDATE THREAD ERROR:', error);
    res.status(500).json({ success: false, message: 'Error updating thread' });
  }
});

// DELETE /api/threads/:id - Delete thread (creator or admin only)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    console.log(`\n🗑️ DELETE REQUEST | Thread: ${id} | User: ${userId}`);

    // Find the thread first to check ownership
    const thread = await Thread.findById(id);
    if (!thread) {
      console.log('❌ Thread not found');
      return res.status(404).json({ 
        success: false, 
        message: 'Thread not found' 
      });
    }

    // Check if user is the creator
    const isCreator = thread.creator.toString() === userId;
    console.log(`  Creator check: thread.creator=${thread.creator} vs userId=${userId} => ${isCreator}`);

    // Check if user is admin from the database
    let isAdmin = false;
    try {
      const user = await User.findById(userId);
      isAdmin = user?.isAdmin === true;
      console.log(`  Admin check: user.isAdmin=${user?.isAdmin} => ${isAdmin}`);
    } catch (e) {
      console.log('  Could not check admin status');
    }
    
    if (!isCreator && !isAdmin) {
      console.log('❌ Permission denied - not creator or admin');
      return res.status(403).json({ 
        success: false, 
        message: 'Only the thread creator or an admin can delete this thread' 
      });
    }

    await Promise.all([
      Thread.findByIdAndDelete(id),
      Message.deleteMany({ threadId: id })
    ]);

    console.log(`✅ THREAD DELETED | ID: ${id} | By: ${userId} (${isCreator ? 'creator' : 'admin'})`);

    // Emit socket event
    const io = req.app.get('io');
    io.emit('refresh-threads');

    res.json({ success: true, message: 'Thread deleted' });
  } catch (error) {
    console.error('❌ DELETE THREAD ERROR:', error);
    res.status(500).json({ success: false, message: 'Error deleting thread' });
  }
});

// POST /api/threads/:id/join - Request to join thread
router.post('/:id/join', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    const thread = await Thread.findById(id);
    if (!thread) {
      return res.status(404).json({ success: false, message: 'Thread not found' });
    }

    if (thread.members.includes(userId) || thread.pendingRequests.includes(userId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Already a member or request pending' 
      });
    }

    thread.pendingRequests.push(userId);
    await thread.save();

    // Emit socket event
    const io = req.app.get('io');
    io.emit('refresh-threads');

    res.json({ success: true, message: 'Join request sent' });
  } catch (error) {
    console.error('❌ JOIN REQUEST ERROR:', error);
    res.status(500).json({ success: false, message: 'Error sending join request' });
  }
});

// POST /api/threads/:id/requests - Handle join request
router.post('/:id/requests', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, approve, currentUserId } = req.body;

    const thread = await Thread.findById(id);
    if (!thread) {
      return res.status(404).json({ success: false, message: 'Thread not found' });
    }

    if (thread.creator.toString() !== currentUserId) {
      return res.status(403).json({ 
        success: false, 
        message: 'Only thread creator can handle requests' 
      });
    }

    thread.pendingRequests = thread.pendingRequests.filter(
      reqId => reqId.toString() !== userId
    );

    if (approve) {
      thread.members.push(userId);
      
      const user = await User.findById(userId);
      
      const welcomeMessage = new Message({
        threadId: id,
        userId: userId,
        username: 'System',
        message: `${user?.username || 'User'} joined the thread!`
      });
      await welcomeMessage.save();

      // Emit new message to thread room
      const io = req.app.get('io');
      io.to(id).emit('new-message', {
        id: welcomeMessage._id.toString(),
        user: 'System',
        userId: userId,
        message: welcomeMessage.message,
        timestamp: welcomeMessage.timestamp.toISOString(),
        replyToMessageId: null,
        replyToUser: null,
        replyPreview: null
      });
    }

    await thread.save();

    // Emit socket event
    const io = req.app.get('io');
    io.emit('refresh-threads');

    res.json({ 
      success: true, 
      message: approve ? 'User approved' : 'User rejected' 
    });
  } catch (error) {
    console.error('❌ HANDLE REQUEST ERROR:', error);
    res.status(500).json({ success: false, message: 'Error handling request' });
  }
});

export default router;