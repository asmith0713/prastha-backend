

// //working
// import express from 'express';
// import { Gossip, GossipComment } from '../models/index.js';

// const router = express.Router();

// // GET /api/gossips - Get all gossips
// router.get('/', async (req, res) => {
//   try {
//     const { sortBy = 'newest' } = req.query;
    
//     let sortOptions = { createdAt: -1 }; // Default: newest first
    
//     if (sortBy === 'popular') {
//       sortOptions = { upvotes: -1 };
//     } else if (sortBy === 'controversial') {
//       sortOptions = { downvotes: -1 };
//     }

//     const gossips = await Gossip.find()
//       .sort(sortOptions)
//       .lean();

//     const gossipsWithComments = await Promise.all(
//       gossips.map(async (gossip) => {
//         // Get ALL comments (including replies) sorted by creation time
//         const comments = await GossipComment.find({ gossipId: gossip._id })
//           .sort({ createdAt: 1 }) // Ascending order for better threading
//           .lean();

//         return {
//           id: gossip._id.toString(),
//           content: gossip.content,
//           author: gossip.authorUsername,
//           authorId: gossip.author.toString(),
//           isAnonymous: false,
//           upvotes: gossip.upvotedBy?.length || 0,
//           downvotes: gossip.downvotedBy?.length || 0,
//           upvotedBy: gossip.upvotedBy?.map(id => id.toString()) || [],
//           downvotedBy: gossip.downvotedBy?.map(id => id.toString()) || [],
//           lastActivity: gossip.lastActivity.toISOString(),
//           expiresAt: gossip.expiresAt.toISOString(),
//           comments: comments.map(comment => ({
//             id: comment._id.toString(),
//             content: comment.content,
//             author: comment.authorUsername,
//             authorId: comment.author.toString(),
//             isAnonymous: false,
//             parentCommentId: comment.parentCommentId?.toString() || null,
//             replyTo: comment.replyTo || null,
//             createdAt: comment.createdAt.toISOString()
//           })),
//           createdAt: gossip.createdAt.toISOString()
//         };
//       })
//     );

//     res.json({ success: true, gossips: gossipsWithComments });
//   } catch (error) {
//     console.error('❌ GET GOSSIPS ERROR:', error);
//     res.status(500).json({ success: false, message: 'Error fetching gossips' });
//   }
// });

// // POST /api/gossips - Create new gossip
// router.post('/', async (req, res) => {
//   try {
//     const { content, authorId, authorUsername } = req.body;

//     if (!content || !content.trim()) {
//       return res.status(400).json({ 
//         success: false, 
//         message: 'Gossip content is required' 
//       });
//     }

//     const gossip = new Gossip({
//       content: content.trim(),
//       author: authorId,
//       authorUsername,
//       isAnonymous: false,
//       upvotedBy: [],
//       downvotedBy: []
//     });

//     await gossip.save();

//     res.status(201).json({
//       success: true,
//       gossip: {
//         id: gossip._id.toString(),
//         content: gossip.content,
//         author: gossip.authorUsername,
//         authorId: gossip.author.toString(),
//         isAnonymous: false,
//         upvotes: 0,
//         downvotes: 0,
//         upvotedBy: [],
//         downvotedBy: [],
//         comments: [],
//         createdAt: gossip.createdAt.toISOString()
//       }
//     });
//   } catch (error) {
//     console.error('❌ CREATE GOSSIP ERROR:', error);
//     res.status(500).json({ success: false, message: 'Error creating gossip' });
//   }
// });

// // POST /api/gossips/:id/vote - Upvote or downvote
// router.post('/:id/vote', async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { userId, voteType } = req.body; // voteType: 'up' or 'down'

//     const gossip = await Gossip.findById(id);
//     if (!gossip) {
//       return res.status(404).json({ success: false, message: 'Gossip not found' });
//     }

//     // Remove from both arrays first
//     gossip.upvotedBy = gossip.upvotedBy.filter(uid => uid.toString() !== userId);
//     gossip.downvotedBy = gossip.downvotedBy.filter(uid => uid.toString() !== userId);

//     // Add to appropriate array
//     if (voteType === 'up') {
//       gossip.upvotedBy.push(userId);
//     } else if (voteType === 'down') {
//       gossip.downvotedBy.push(userId);
//     }

//     await gossip.save();

//     // Emit socket event
//     const io = req.app.get('io');
//     io.emit('gossip-updated', {
//       gossipId: id,
//       upvotes: gossip.upvotedBy.length,
//       downvotes: gossip.downvotedBy.length
//     });

//     res.json({ 
//       success: true,
//       upvotes: gossip.upvotedBy.length,
//       downvotes: gossip.downvotedBy.length
//     });
//   } catch (error) {
//     console.error('❌ VOTE ERROR:', error);
//     res.status(500).json({ success: false, message: 'Error voting' });
//   }
// });

// // POST /api/gossips/:id/comments - Add comment or reply
// router.post('/:id/comments', async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { content, authorId, authorUsername, parentCommentId, replyTo } = req.body;

//     if (!content || !content.trim()) {
//       return res.status(400).json({ 
//         success: false, 
//         message: 'Comment content is required' 
//       });
//     }

//     // Create comment object with optional parent and replyTo fields
//     const commentData = {
//       gossipId: id,
//       content: content.trim(),
//       author: authorId,
//       authorUsername,
//       isAnonymous: false
//     };

//     // Add parentCommentId and replyTo if this is a reply
//     if (parentCommentId) {
//       commentData.parentCommentId = parentCommentId;
//     }
//     if (replyTo) {
//       commentData.replyTo = replyTo;
//     }

//     const comment = new GossipComment(commentData);
//     await comment.save();

//     // Update gossip's lastActivity
//     await Gossip.findByIdAndUpdate(id, { 
//       lastActivity: new Date() 
//     });

//     // Emit socket event
//     const io = req.app.get('io');
//     io.emit('gossip-comment-added', { gossipId: id });

//     res.status(201).json({
//       success: true,
//       comment: {
//         id: comment._id.toString(),
//         content: comment.content,
//         author: comment.authorUsername,
//         authorId: comment.author.toString(),
//         isAnonymous: false,
//         parentCommentId: comment.parentCommentId?.toString() || null,
//         replyTo: comment.replyTo || null,
//         createdAt: comment.createdAt.toISOString()
//       }
//     });
//   } catch (error) {
//     console.error('❌ ADD COMMENT ERROR:', error);
//     res.status(500).json({ success: false, message: 'Error adding comment' });
//   }
// });

// // DELETE /api/gossips/:id - Delete gossip (admin or author)
// router.delete('/:id', async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { userId } = req.body;

//     const gossip = await Gossip.findById(id);
//     if (!gossip) {
//       return res.status(404).json({ success: false, message: 'Gossip not found' });
//     }

//     // Check if user is admin or author
//     if (userId !== 'admin_001' && gossip.author.toString() !== userId) {
//       return res.status(403).json({ 
//         success: false, 
//         message: 'Not authorized to delete this gossip' 
//       });
//     }

//     await Promise.all([
//       Gossip.findByIdAndDelete(id),
//       GossipComment.deleteMany({ gossipId: id })
//     ]);

//     // Emit socket event
//     const io = req.app.get('io');
//     io.emit('gossip-deleted', { gossipId: id });

//     res.json({ success: true, message: 'Gossip deleted' });
//   } catch (error) {
//     console.error('❌ DELETE GOSSIP ERROR:', error);
//     res.status(500).json({ success: false, message: 'Error deleting gossip' });
//   }
// });

// export default router;

import express from 'express';
import { Gossip, GossipComment, CommentReport, User } from '../models/index.js';

const router = express.Router();

const ADMIN_PLACEHOLDER_ID = 'admin_001';

async function isAdminUser(userId) {
  if (!userId) return false;
  if (userId === ADMIN_PLACEHOLDER_ID) return true;
  try {
    const user = await User.findById(userId).lean();
    return Boolean(user?.isAdmin);
  } catch (error) {
    console.error('⚠️  ADMIN CHECK ERROR:', error.message);
    return false;
  }
}

// GET /api/gossips
router.get('/', async (req, res) => {
  try {
    const { sortBy = 'newest' } = req.query;
    
    let sortOptions = { createdAt: -1 };
    
    if (sortBy === 'popular') {
      sortOptions = { upvotes: -1 };
    } else if (sortBy === 'controversial') {
      sortOptions = { downvotes: -1 };
    }

    const gossips = await Gossip.find()
      .sort(sortOptions)
      .lean();

    const gossipsWithComments = await Promise.all(
      gossips.map(async (gossip) => {
        const comments = await GossipComment.find({ gossipId: gossip._id })
          .sort({ createdAt: 1 })
          .lean();

        return {
          id: gossip._id.toString(),
          content: gossip.content,
          author: gossip.authorUsername,
          authorId: gossip.author.toString(),
          isAnonymous: false,
          upvotes: gossip.upvotedBy?.length || 0,
          downvotes: gossip.downvotedBy?.length || 0,
          upvotedBy: gossip.upvotedBy?.map(id => id.toString()) || [],
          downvotedBy: gossip.downvotedBy?.map(id => id.toString()) || [],
          lastActivity: gossip.lastActivity.toISOString(),
          expiresAt: gossip.expiresAt.toISOString(),
          comments: comments.map(comment => ({
            id: comment._id.toString(),
            content: comment.content,
            author: comment.authorUsername,
            authorId: comment.author.toString(),
            isAnonymous: false,
            parentCommentId: comment.parentCommentId?.toString() || null,
            replyTo: comment.replyTo || null,
            upvotes: comment.upvotedBy?.length || 0,
            downvotes: comment.downvotedBy?.length || 0,
            upvotedBy: comment.upvotedBy?.map(id => id.toString()) || [],
            downvotedBy: comment.downvotedBy?.map(id => id.toString()) || [],
            createdAt: comment.createdAt.toISOString()
          })),
          createdAt: gossip.createdAt.toISOString()
        };
      })
    );

    res.json({ success: true, gossips: gossipsWithComments });
  } catch (error) {
    console.error('❌ GET GOSSIPS ERROR:', error);
    res.status(500).json({ success: false, message: 'Error fetching gossips' });
  }
});

// POST /api/gossips
router.post('/', async (req, res) => {
  try {
    const { content, authorId, authorUsername } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ 
        success: false, 
        message: 'Gossip content is required' 
      });
    }

    const gossip = new Gossip({
      content: content.trim(),
      author: authorId,
      authorUsername,
      isAnonymous: false,
      upvotedBy: [],
      downvotedBy: []
    });

    await gossip.save();

    res.status(201).json({
      success: true,
      gossip: {
        id: gossip._id.toString(),
        content: gossip.content,
        author: gossip.authorUsername,
        authorId: gossip.author.toString(),
        isAnonymous: false,
        upvotes: 0,
        downvotes: 0,
        upvotedBy: [],
        downvotedBy: [],
        comments: [],
        createdAt: gossip.createdAt.toISOString()
      }
    });
  } catch (error) {
    console.error('❌ CREATE GOSSIP ERROR:', error);
    res.status(500).json({ success: false, message: 'Error creating gossip' });
  }
});

// POST /api/gossips/:id/vote
router.post('/:id/vote', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, voteType } = req.body;

    const gossip = await Gossip.findById(id);
    if (!gossip) {
      return res.status(404).json({ success: false, message: 'Gossip not found' });
    }

    gossip.upvotedBy = gossip.upvotedBy.filter(uid => uid.toString() !== userId);
    gossip.downvotedBy = gossip.downvotedBy.filter(uid => uid.toString() !== userId);

    if (voteType === 'up') {
      gossip.upvotedBy.push(userId);
    } else if (voteType === 'down') {
      gossip.downvotedBy.push(userId);
    }

    await gossip.save();

    const io = req.app.get('io');
    io.emit('gossip-updated', {
      gossipId: id,
      upvotes: gossip.upvotedBy.length,
      downvotes: gossip.downvotedBy.length
    });

    res.json({ 
      success: true,
      upvotes: gossip.upvotedBy.length,
      downvotes: gossip.downvotedBy.length
    });
  } catch (error) {
    console.error('❌ VOTE ERROR:', error);
    res.status(500).json({ success: false, message: 'Error voting' });
  }
});

// POST /api/gossips/:id/comments
router.post('/:id/comments', async (req, res) => {
  try {
    const { id } = req.params;
    const { content, authorId, authorUsername, parentCommentId, replyTo } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ 
        success: false, 
        message: 'Comment content is required' 
      });
    }

    const commentData = {
      gossipId: id,
      content: content.trim(),
      author: authorId,
      authorUsername,
      isAnonymous: false
    };

    if (parentCommentId) {
      commentData.parentCommentId = parentCommentId;
    }
    if (replyTo) {
      commentData.replyTo = replyTo;
    }

    const comment = new GossipComment(commentData);
    await comment.save();

    await Gossip.findByIdAndUpdate(id, { 
      lastActivity: new Date() 
    });

    const io = req.app.get('io');
    io.emit('gossip-comment-added', { gossipId: id });

    res.status(201).json({
      success: true,
      comment: {
        id: comment._id.toString(),
        content: comment.content,
        author: comment.authorUsername,
        authorId: comment.author.toString(),
        isAnonymous: false,
        parentCommentId: comment.parentCommentId?.toString() || null,
        replyTo: comment.replyTo || null,
        upvotes: comment.upvotedBy?.length || 0,
        downvotes: comment.downvotedBy?.length || 0,
        upvotedBy: comment.upvotedBy?.map((entry) => entry.toString()) || [],
        downvotedBy: comment.downvotedBy?.map((entry) => entry.toString()) || [],
        createdAt: comment.createdAt.toISOString()
      }
    });
  } catch (error) {
    console.error('❌ ADD COMMENT ERROR:', error);
    res.status(500).json({ success: false, message: 'Error adding comment' });
  }
});

// POST /api/gossips/:gossipId/comments/:commentId/vote
router.post('/:gossipId/comments/:commentId/vote', async (req, res) => {
  try {
    const { gossipId, commentId } = req.params;
    const { userId, voteType } = req.body;

    if (!userId || !voteType) {
      return res.status(400).json({
        success: false,
        message: 'User and voteType are required'
      });
    }

    if (!['up', 'down', 'none'].includes(voteType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid vote type'
      });
    }

    const comment = await GossipComment.findOne({ _id: commentId, gossipId });
    if (!comment) {
      return res.status(404).json({ success: false, message: 'Comment not found' });
    }

    comment.upvotedBy = comment.upvotedBy.filter((uid) => uid.toString() !== userId);
    comment.downvotedBy = comment.downvotedBy.filter((uid) => uid.toString() !== userId);

    if (voteType === 'up') {
      comment.upvotedBy.push(userId);
    } else if (voteType === 'down') {
      comment.downvotedBy.push(userId);
    }

    await comment.save();

    res.json({
      success: true,
      upvotes: comment.upvotedBy.length,
      downvotes: comment.downvotedBy.length,
      upvotedBy: comment.upvotedBy.map((uid) => uid.toString()),
      downvotedBy: comment.downvotedBy.map((uid) => uid.toString())
    });
  } catch (error) {
    console.error('❌ COMMENT VOTE ERROR:', error);
    res.status(500).json({ success: false, message: 'Error voting on comment' });
  }
});

// POST /api/gossips/:gossipId/comments/:commentId/report
router.post('/:gossipId/comments/:commentId/report', async (req, res) => {
  try {
    const { gossipId, commentId } = req.params;
    const { reporterUsername, reporterId, commentAuthor, commentAuthorId, commentContent, reason } = req.body;

    console.log(`\n🚨 COMMENT REPORT | Comment ID: ${commentId} | Reporter: ${reporterUsername}`);

    const comment = await GossipComment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ 
        success: false, 
        message: 'Comment not found' 
      });
    }

    const existingReport = await CommentReport.findOne({
      commentId,
      reporterId
    });

    if (existingReport) {
      return res.status(400).json({
        success: false,
        message: 'You have already reported this comment'
      });
    }

    const report = new CommentReport({
      gossipId,
      commentId,
      commentContent,
      commentAuthor,
      commentAuthorId,
      reporter: reporterUsername,
      reporterId,
      reason: reason || 'Inappropriate content',
      status: 'pending'
    });

    await report.save();

    console.log(`✅ REPORT SAVED | Report ID: ${report._id}`);

    const io = req.app.get('io');
    io.emit('new-comment-report', {
      reportId: report._id.toString(),
      commentId,
      reporter: reporterUsername,
      commentAuthor,
      timestamp: report.createdAt
    });

    res.status(201).json({
      success: true,
      message: 'Comment reported successfully. Admin will review it shortly.',
      report: {
        id: report._id.toString(),
        status: report.status,
        createdAt: report.createdAt.toISOString()
      }
    });
  } catch (error) {
    console.error('❌ REPORT COMMENT ERROR:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error reporting comment' 
    });
  }
});

// GET /api/gossips/reports/all
router.get('/reports/all', async (req, res) => {
  try {
    const { userId } = req.query;

    if (!(await isAdminUser(userId))) {
      return res.status(403).json({ 
        success: false, 
        message: 'Admin access required' 
      });
    }

    const reports = await CommentReport.find()
      .sort({ createdAt: -1 })
      .lean();

    console.log(`📊 FETCHED ${reports.length} REPORTS`);

    const reportsData = reports.map(report => ({
      id: report._id.toString(),
      gossipId: report.gossipId.toString(),
      commentId: report.commentId.toString(),
      commentContent: report.commentContent,
      commentAuthor: report.commentAuthor,
      commentAuthorId: report.commentAuthorId.toString(),
      reporter: report.reporter,
      reporterId: report.reporterId.toString(),
      reason: report.reason,
      status: report.status,
      adminNotes: report.adminNotes,
      reviewedBy: report.reviewedBy,
      reviewedAt: report.reviewedAt ? report.reviewedAt.toISOString() : null,
      createdAt: report.createdAt.toISOString()
    }));

    res.json({ 
      success: true, 
      reports: reportsData,
      stats: {
        total: reports.length,
        pending: reports.filter(r => r.status === 'pending').length,
        reviewed: reports.filter(r => r.status === 'reviewed').length,
        dismissed: reports.filter(r => r.status === 'dismissed').length,
        actionTaken: reports.filter(r => r.status === 'action-taken').length
      }
    });
  } catch (error) {
    console.error('❌ GET REPORTS ERROR:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching reports' 
    });
  }
});

// PUT /api/gossips/reports/:reportId
router.put('/reports/:reportId', async (req, res) => {
  try {
    const { reportId } = req.params;
    const { userId, status, adminNotes, adminUsername } = req.body;

    if (!(await isAdminUser(userId))) {
      return res.status(403).json({ 
        success: false, 
        message: 'Admin access required' 
      });
    }

    const report = await CommentReport.findById(reportId);
    if (!report) {
      return res.status(404).json({ 
        success: false, 
        message: 'Report not found' 
      });
    }

    report.status = status;
    report.adminNotes = adminNotes || report.adminNotes;
    report.reviewedBy = adminUsername;
    report.reviewedAt = new Date();

    await report.save();

    console.log(`✅ REPORT UPDATED | ID: ${reportId} | Status: ${status}`);

    res.json({
      success: true,
      message: 'Report updated successfully',
      report: {
        id: report._id.toString(),
        status: report.status,
        reviewedBy: report.reviewedBy,
        reviewedAt: report.reviewedAt.toISOString()
      }
    });
  } catch (error) {
    console.error('❌ UPDATE REPORT ERROR:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error updating report' 
    });
  }
});

// DELETE /api/gossips/:id
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    const gossip = await Gossip.findById(id);
    if (!gossip) {
      return res.status(404).json({ success: false, message: 'Gossip not found' });
    }

    const isAdmin = await isAdminUser(userId);

    if (!isAdmin && gossip.author.toString() !== userId) {
      return res.status(403).json({ 
        success: false, 
        message: 'Not authorized to delete this gossip' 
      });
    }

    await Promise.all([
      Gossip.findByIdAndDelete(id),
      GossipComment.deleteMany({ gossipId: id }),
      CommentReport.deleteMany({ gossipId: id })
    ]);

    const io = req.app.get('io');
    io.emit('gossip-deleted', { gossipId: id });

    res.json({ success: true, message: 'Gossip deleted' });
  } catch (error) {
    console.error('❌ DELETE GOSSIP ERROR:', error);
    res.status(500).json({ success: false, message: 'Error deleting gossip' });
  }
});

// DELETE /api/gossips/:gossipId/comments/:commentId
router.delete('/:gossipId/comments/:commentId', async (req, res) => {
  try {
    const { gossipId, commentId } = req.params;
    const { userId } = req.body;

    const comment = await GossipComment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ 
        success: false, 
        message: 'Comment not found' 
      });
    }

    const isAdmin = await isAdminUser(userId);

    if (!isAdmin && comment.author.toString() !== userId) {
      return res.status(403).json({ 
        success: false, 
        message: 'Not authorized to delete this comment' 
      });
    }

    await Promise.all([
      GossipComment.findByIdAndDelete(commentId),
      CommentReport.deleteMany({ commentId })
    ]);

    const io = req.app.get('io');
    io.emit('gossip-comment-deleted', { gossipId, commentId });

    console.log(`🗑️  COMMENT DELETED | ID: ${commentId}`);

    res.json({ 
      success: true, 
      message: 'Comment deleted successfully' 
    });
  } catch (error) {
    console.error('❌ DELETE COMMENT ERROR:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error deleting comment' 
    });
  }
});

export default router;