/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

// Use v2 imports consistently
const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentCreated, onDocumentDeleted } = require("firebase-functions/v2/firestore"); // Import v2 Firestore triggers
const admin = require("firebase-admin");
const Shotstack = require("shotstack-sdk"); 
const functions = require("firebase-functions"); // Still needed for config
const nodemailer = require("nodemailer"); // Add nodemailer

// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

// exports.helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });

// DO NOT initialize admin app globally
// const app = admin.initializeApp(); // <-- Comment out
// const db = admin.firestore(); // <-- Comment out

let adminApp;
let firestoreDb;
let mailTransport;

function initializeFirebase() {
  if (!adminApp) {
    console.log("Initializing Firebase Admin SDK...");
    adminApp = admin.initializeApp();
    firestoreDb = admin.firestore();
    console.log("Firebase Admin SDK initialized.");
    
    // Initialize email transport with more flexible configuration
    const emailConfig = functions.config().email || {};
    const gmailConfig = functions.config().gmail || {}; // Keep for backward compatibility
    
    // Use either the new email config or fall back to gmail config
    if (emailConfig.host && emailConfig.user && emailConfig.password) {
      // Use generic SMTP configuration
      mailTransport = nodemailer.createTransport({
        host: emailConfig.host,
        port: emailConfig.port || 587,
        secure: emailConfig.secure === 'true',
        auth: {
          user: emailConfig.user,
          pass: emailConfig.password,
        },
      });
      console.log(`Email transport initialized with host: ${emailConfig.host}`);
    } else if (gmailConfig.email && gmailConfig.password) {
      // Fall back to Gmail-specific configuration for backward compatibility
      mailTransport = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: gmailConfig.email,
          pass: gmailConfig.password,
        },
      });
      console.log("Email transport initialized with Gmail service.");
    } else {
      console.warn("Email configuration not found. Email functionality will not work.");
    }
  }
}

// Keep config reading global OR move it inside functions too.
// Reading it here might be okay, but check errors.
// const shotstackConfig = functions.config().shotstack || {};
// const shotstackApiKey = shotstackConfig.key;
// const shotstackStage = shotstackConfig.stage || "v1";
// const shotstackWebhookSecret = shotstackConfig.webhook_secret;
// if (!shotstackApiKey || !shotstackWebhookSecret) {
//   console.error("FATAL ERROR: Shotstack API Key or Webhook Secret not configured.");
// }

// DO NOT initialize the client globally
// const defaultClient = Shotstack.ApiClient.instance; 
// ... etc ...
// const api = new Shotstack.EditApi();

/**
 * Updates a user's profile information in Firestore.
 * @param {Object} data - The profile data to update
 * @param {string} data.displayName - The user's display name
 * @param {string} data.bio - The user's bio
 * @param {string} data.profilePic - The user's profile picture URL
 * @param {Object} context - The function context
 * @return {Promise<Object>} A promise that resolves to a success object
 */
exports.updateUserProfile = onCall(async (request) => {
  initializeFirebase(); // Ensure Firebase is initialized before use

  if (!request.auth) {
    // Use v2 HttpsError
    throw new HttpsError("unauthenticated", "The function must be called while authenticated.");
  }

  const {displayName, bio, profilePic} = request.data;
  const userId = request.auth.uid;

  try {
    // Use the lazily initialized firestoreDb variable
    await firestoreDb.collection("users").doc(userId).update({
      displayName,
      bio,
      profilePic,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log(`Profile updated successfully for user: ${userId}`);
    return {success: true};
  } catch (error) {
    console.error(`Error updating profile for user ${userId}:`, error);
    // Use v2 HttpsError
    throw new HttpsError("internal", "An error occurred while updating the profile.", error);
  }
});

// --- Function: startVideoProcessing (Convert to v2 onCall) ---
/*
exports.startVideoProcessing = onCall(async (request) => { // Changed to v2 onCall
  initializeFirebase(); // Ensure Firebase is initialized before use

  // 1. Authentication Check
  if (!request.auth) { // Use request.auth
    throw new HttpsError( // Use v2 HttpsError
        "unauthenticated",
        "The function must be called while authenticated.",
    );
  }
  const userId = request.auth.uid;

  // 2. Input Validation (Basic)
  const {instructions, videoId} = request.data; // Use request.data
  if (!instructions || !videoId) {
    throw new HttpsError( // Use v2 HttpsError
        "invalid-argument",
        "Missing 'instructions' or 'videoId'.",
    );
  }
  if (!Array.isArray(instructions.segments) || !Array.isArray(instructions.audioTracks) || !Array.isArray(instructions.textOverlays)) {
      throw new HttpsError( // Use v2 HttpsError
        "invalid-argument",
        "Invalid 'instructions' structure."
      );
  }

  // === Read Config INSIDE the function ===
  const shotstackConfig = functions.config().shotstack || {};
  const shotstackApiKey = shotstackConfig.key;
  const shotstackStage = shotstackConfig.stage || "v1";
  const shotstackWebhookSecret = shotstackConfig.webhook_secret;
  // ======================================

  // Check config *inside* the function
  if (!shotstackApiKey) {
      console.error(`Missing Shotstack API key for video ${videoId}`);
      throw new HttpsError("internal", "Server configuration error [SK].");
  }
  if (!shotstackWebhookSecret) {
      console.error(`Missing Shotstack Webhook Secret for video ${videoId}`);
      throw new HttpsError("internal", "Server configuration error [SS].");
  }

  try {
    // === Initialize Shotstack Client INSIDE the function ===
    console.log("Initializing Shotstack client...");
    const defaultClient = Shotstack.ApiClient.instance;
    const DeveloperKey = defaultClient.authentications["DeveloperKey"];
    defaultClient.basePath = `https://api.shotstack.io/${shotstackStage}`;
    DeveloperKey.apiKey = shotstackApiKey;
    const api = new Shotstack.EditApi();
    // =======================================================

    // 3. Translate EditInstructions to Shotstack Edit JSON
    console.log(`Translating instructions for video: ${videoId}`);

    // --- Define Tracks --- 
    const tracks = [];

    // --- Video Track ---
    const videoClips = instructions.segments.map((segment) => {
      const clip = {
        asset: {
          type: "video",
          src: segment.fileUrl,
          volume: segment.isMuted ? 0 : (segment.volume ?? 1), // Apply volume/mute
        }, // Shotstack.VideoAsset equivalent
        start: segment.startTime,
        length: segment.endTime - segment.startTime,
        // effect: "fadeInFadeOut" // Optional effect for video clips
      };
      // Add more properties like fit, scale, filters if needed
      return clip;
    });
    if (videoClips.length > 0) {
        tracks.push({ clips: videoClips });
    }

    // --- Audio Tracks ---
    instructions.audioTracks.forEach((track) => {
      const audioClip = {
        asset: {
          type: "audio",
          src: track.fileUrl,
          volume: track.isMuted ? 0 : (track.volume ?? 1),
        }, // Shotstack.AudioAsset equivalent
        start: track.startTime,
        length: track.duration,
      };
      tracks.push({ clips: [audioClip] }); // Each audio track on its own timeline track
    });

    // --- Text Overlay Tracks ---
    // Create a separate track for all text overlays
    const textClips = instructions.textOverlays.map((text) => {
        // Basic mapping of percentage position to Shotstack presets
        let shotstackPosition = 'center';
        // Add more sophisticated mapping logic if needed based on text.position.x/y
        if (text.position.y < 30) shotstackPosition = 'top';
        else if (text.position.y > 70) shotstackPosition = 'bottom';

        const titleAsset = {
            type: "title",
            text: text.text,
            style: "minimal", // Or potentially use CSS with HTMLAsset for more control
            color: text.color ?? "#ffffff",
            size: `${text.fontSize ?? 24}px`, // Ensure size unit is appropriate
            position: shotstackPosition, 
            // offset: { x: ..., y: ... } // Further refinement for position
            fontFamily: text.fontFamily, // Requires font availability in Shotstack
            backgroundColor: text.backgroundColor === 'transparent' ? undefined : text.backgroundColor,
            // Add mappings for fontWeight, fontStyle, decoration if possible with chosen style/asset type
        };

        const textClip = {
            asset: titleAsset, // Shotstack.TitleAsset equivalent
            start: text.startTime,
            length: text.duration,
            // Apply opacity and rotation to the clip itself
            opacity: text.opacity ?? 1,
            transform: text.rotation ? { rotate: text.rotation } : undefined,
        };
        // Add border mapping logic if needed (might require effects or HTMLAsset)
        return textClip;
    });
     if (textClips.length > 0) {
        tracks.push({ clips: textClips });
    }

    // --- Combine into Timeline ---
    const timeline = { // Shotstack.Timeline equivalent in JS
      // Soundtrack might be redundant if separate audio tracks are used comprehensively
      // soundtrack: instructions.audioTracks?.[0] ? { ... } : undefined,
      background: "#000000", // Default background
      tracks: tracks, // Use the constructed tracks array
    };

    // 4. Define Shotstack Output
    const output = { // Shotstack.Output equivalent
      format: "mp4",
      resolution: "hd", // Or sd, 1080, 720 etc.
      // Consider adding aspect ratio based on editor settings or first video
      // aspectRatio: "9:16", // For vertical videos
    };

    // 5. Define Shotstack Edit Object (Callback URL)
    const projectId = process.env.GCLOUD_PROJECT;
    const edit = { 
      timeline: timeline,
      output: output,
      callback: `https://processshotstackwebhook-rvqs7sntba-uc.a.run.app?videoId=${videoId}&secret=${shotstackWebhookSecret}`,
    };

    // 6. Submit Render Job to Shotstack
    console.log(`Submitting job to Shotstack for video: ${videoId}`);
    const render = await api.postRender(edit).catch((apiError) => {
        console.error("Shotstack API Error:", apiError?.response?.data || apiError.message);
        throw new HttpsError("internal", "Shotstack API submission failed.", apiError?.response?.data);
    });
    const renderId = render.response.id;
    console.log(`Shotstack render submitted successfully. Render ID: ${renderId}`);

    // 7. Update Firestore document with Render ID
    await firestoreDb.collection("videos").doc(videoId).update({
      renderId: renderId,
      status: "submitted",
    });

    console.log(`Firestore document updated with Render ID for video: ${videoId}`);
    return {success: true, message: "Processing started", renderId: renderId};
  } catch (error) {
    console.error(`Error starting video processing for video: ${videoId}`, error);
    // Update Firestore status to 'failed'
    try {
      await firestoreDb.collection("videos").doc(videoId).update({
        status: "failed",
        error: `Backend Error: ${error.message || String(error)}`,
      });
    } catch (updateError) {
      console.error("Failed to update Firestore status to failed:", updateError);
    }
    // Rethrow or translate the error for the client
     if (error instanceof HttpsError) { // Check against imported HttpsError
        throw error; // Rethrow HttpsError
      } else {
        throw new HttpsError(
            "internal",
            `Failed to start video processing: ${error.message || String(error)}`,
        );
      }
  }
});
*/

// --- Function: processShotstackWebhook (Convert to v2 onRequest) ---
/*
exports.processShotstackWebhook = onRequest(async (request, response) => { // Changed to v2 onRequest
  initializeFirebase(); // Ensure Firebase is initialized before use

  console.log("Received Shotstack webhook callback.");
  
  // === Read Config INSIDE the function ===
  const currentWebhookSecret = functions.config().shotstack?.webhook_secret;
  // ======================================
  
  if (!currentWebhookSecret) {
      console.error("Webhook secret is not configured on the server.");
      response.status(500).send("Server Configuration Error");
      return;
  }

  // 1. Security Check (Method and Secret)
  if (request.method !== 'POST') {
      console.error("Webhook received with invalid method:", request.method);
      response.status(405).send("Method Not Allowed");
      return;
  }
  const {videoId, secret} = request.query; // Use request.query
  if (secret !== currentWebhookSecret) { // Use the newly read secret
    console.error("Webhook secret mismatch.");
    response.status(401).send("Unauthorized");
    return;
  }

  // 2. Basic Validation
  if (!videoId || typeof videoId !== "string") {
    console.error("Missing or invalid videoId in webhook query.");
    response.status(400).send("Bad Request: Missing videoId");
    return;
  }

  // 3. Get data from Shotstack payload (request body)
  const {status, url, id: renderId} = request.body; // Use request.body
  console.log(`Processing webhook for videoId: ${videoId}, renderId: ${renderId}, status: ${status}`);

  try {
    const videoRef = firestoreDb.collection("videos").doc(videoId);

    // 4. Update Firestore based on Shotstack status
    if (status === "done") {
      if (!url) {
          console.error(`Render completed for videoId: ${videoId} but no URL provided.`);
          await videoRef.update({
              status: "failed",
              error: "Shotstack completed render but did not provide a URL.",
              renderId: renderId,
          });
           response.status(200).send("Webhook processed for completion error (missing URL).");
           return;
      }
      console.log(`Render completed successfully for videoId: ${videoId}. Final URL: ${url}`);
      await videoRef.update({
        status: "completed",
        url: url, // Store the final video URL
        renderId: renderId,
        error: admin.firestore.FieldValue.delete(), // Clear any previous error
      });
      response.status(200).send("Webhook processed successfully.");
    } else if (status === "failed") {
      console.error(`Render failed for videoId: ${videoId}. RenderId: ${renderId}. Body:`, request.body);
      const errorMessage = request.body.error?.message || "Shotstack render failed";
      await videoRef.update({
        status: "failed",
        error: errorMessage,
        renderId: renderId,
      });
      response.status(200).send("Webhook processed for failure."); // Respond 200 so Shotstack doesn't retry
    } else {
      console.log(`Ignoring webhook status '${status}' for videoId: ${videoId}`);
      response.status(200).send(`Status ${status} ignored.`);
    }
  } catch (error) {
    console.error(`Error processing webhook for videoId: ${videoId}:`, error);
    response.status(500).send("Internal Server Error processing webhook.");
  }
});
*/

// --- NEW FUNCTION: Send Email Notification on Notification Creation ---

// Listens for new documents added to /notifications/:documentId and sends an
// email using the Trigger Email extension based on the recipient's email
// stored in the /users collection.
// --- UPDATED TO V2 SYNTAX --- 
exports.sendEmailNotification = onDocumentCreated("notifications/{notificationId}", async (event) => {
      // Important: Initialize Firebase FIRST before doing anything else
      try {
        initializeFirebase(); // Ensure Firebase is initialized
        console.log("Firebase initialized successfully for notification handling");
      
        // Use event.data?.data() to get the data in v2
        const snapshot = event.data;
        if (!snapshot) {
          console.log("No data associated with the event");
          return;
        }
        const notificationData = snapshot.data();

        if (!notificationData) {
          console.log("No data associated with the event snapshot");
          return;
        }

        const recipientId = notificationData.recipientId;
        const notificationContent = notificationData.content;
        const notificationType = notificationData.type || "notification"; // Default type
        const notificationId = event.params?.notificationId || "unknown";

        console.log(`Processing notification ${notificationId} of type ${notificationType}`);

        if (!recipientId) {
          console.log("Notification missing recipientId");
          return;
        }

        console.log(`Notification created for recipient: ${recipientId}, type: ${notificationType}`);

        // Ensure firestoreDb is available
        if (!firestoreDb) {
          console.error("Firestore DB not initialized properly!");
          initializeFirebase(); // Try again
          
          if (!firestoreDb) {
            console.error("Failed to initialize Firestore DB after retry");
            return;
          }
        }

        // Fetch the recipient's user document from the 'users' collection
        const userRef = firestoreDb.collection("users").doc(recipientId);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
          console.log(`User document not found for recipientId: ${recipientId}`);
          return;
        }

        const userData = userDoc.data();
        // IMPORTANT: Make sure the field name 'email' matches how you store it
        const recipientEmail = userData?.email;

        if (!recipientEmail) {
          console.log(`Email not found for user: ${recipientId}`);
          return;
        }

        // Check if user has enabled email notifications for this type
        const emailPreferences = userData.emailPreferences || {};
        
        // Skip sending if the user has disabled this notification type
        if (notificationType === 'message' && emailPreferences.messageNotifications === false) {
          console.log(`User ${recipientId} has disabled message email notifications`);
          return;
        } else if (notificationType === 'follow' && emailPreferences.followNotifications === false) {
          console.log(`User ${recipientId} has disabled follow email notifications`);
          return;
        } else if (notificationType === 'live_stream' && emailPreferences.liveNotifications === false) {
          console.log(`User ${recipientId} has disabled live stream email notifications`);
          return;
        }
        
        console.log(`Found email: ${recipientEmail} for user: ${recipientId}, sending notification`);

        // Prepare email data for the Trigger Email extension
        const mailData = {
          to: [recipientEmail], // Extension expects an array
          message: {
            subject: `New ${notificationType} from SideEye!`,
            text: notificationContent,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #1976d2;">${getNotificationIcon(notificationType)} New ${capitalizeFirstLetter(notificationType)}</h2>
                <p style="font-size: 16px; color: #333;">
                  ${notificationContent}
                </p>
                <div style="margin: 30px 0;">
                  <a href="https://sideeye.uk/notifications" 
                     style="background-color: #1976d2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">
                    View Notification
                  </a>
                </div>
                <p style="font-size: 14px; color: #666; margin-top: 40px;">
                  You're receiving this email because you have enabled notifications on SideEye.
                  <br><br>
                  To unsubscribe from these notifications, update your email preferences in your 
                  <a href="https://sideeye.uk/settings" style="color: #1976d2; text-decoration: none;">SideEye settings</a>.
                </p>
              </div>
            `,
          },
        };

        // Add the email document to the 'mail' collection
        // (Ensure this collection name matches your Trigger Email extension config)
        const mailRef = await firestoreDb.collection("mail").add(mailData);
        console.log(`Email queued successfully with ID ${mailRef.id} for ${recipientEmail}`);
        
        return null; // Indicate successful processing

      } catch (error) {
        console.error("Error processing notification:", error);
        console.error("Error details:", error.message, error.stack);
        return null; // Avoid retrying indefinitely for this kind of error
      }
    });

// Helper function to get appropriate icon for notification type
function getNotificationIcon(type) {
  switch (type) {
    case 'message':
      return '💬';
    case 'follow':
      return '👋';
    case 'live_stream':
      return '📱';
    case 'like':
      return '❤️';
    case 'comment':
      return '💬';
    default:
      return '🔔';
  }
}

// Helper function to capitalize the first letter
function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

// --- NEW FUNCTION: Handle User Deletion Cascade ---

/**
 * Cleans up user data across Firestore when a user document is deleted.
 * Triggered by the deletion of a document in the 'users' collection.
 * @param {Event<QueryDocumentSnapshot>} event - The Firestore event.
 */
exports.onUserDeleted = onDocumentDeleted("users/{userId}", async (event) => {
  initializeFirebase(); // Ensure Firebase is initialized

  const userId = event.params.userId; // Get userId from parameters
  const batch = firestoreDb.batch(); // Use the initialized DB batch

  console.log(`Starting deletion cascade for user: ${userId}`);

  try {
    // --- Add Deletion Logic Here --- 
    // Remember to adjust collection names and field names if they differ!

    // 1. Delete User's Side Rooms
    const createdRoomsQuery = firestoreDb.collection('sideRooms').where('ownerId', '==', userId);
    const createdRoomsSnapshot = await createdRoomsQuery.get();
    createdRoomsSnapshot.forEach(doc => {
        console.log(`[Delete User ${userId}] Deleting created room: ${doc.id}`);
        batch.delete(doc.ref);
        // TODO: Add logic to delete subcollections within rooms if necessary (e.g., presence)
        // This would likely require another batch or separate operations.
    });

    // 2. Delete User's Notifications (where they are the recipient)
    const notificationsQuery = firestoreDb.collection('notifications').where('recipientId', '==', userId);
    const notificationsSnapshot = await notificationsQuery.get();
    notificationsSnapshot.forEach(doc => {
        console.log(`[Delete User ${userId}] Deleting notification: ${doc.id}`);
        batch.delete(doc.ref);
    });

    // 3. Remove user from others' Following lists (based on the deleted user's Followers list)
    const followersQuery = firestoreDb.collection(`users/${userId}/followers`);
    const followersSnapshot = await followersQuery.get();
    followersSnapshot.forEach(doc => {
        const followerId = doc.id;
        const followingRef = firestoreDb.doc(`users/${followerId}/following/${userId}`);
        console.log(`[Delete User ${userId}] Removing from ${followerId}'s following list`);
        batch.delete(followingRef);
        // Also delete the follower doc from the *deleted user's* subcollection
        batch.delete(doc.ref);
    });

    // 4. Remove user from others' Followers lists (based on the deleted user's Following list)
    const followingQuery = firestoreDb.collection(`users/${userId}/following`);
    const followingSnapshot = await followingQuery.get();
    followingSnapshot.forEach(doc => {
        const followedId = doc.id;
        const followerRef = firestoreDb.doc(`users/${followedId}/followers/${userId}`);
        console.log(`[Delete User ${userId}] Removing from ${followedId}'s followers list`);
        batch.delete(followerRef);
        // Also delete the following doc from the *deleted user's* subcollection
        batch.delete(doc.ref);
    });
    
    // 5. Delete Follow Requests sent TO the deleted user
    const followRequestsQuery = firestoreDb.collection(`users/${userId}/followRequests`);
    const followRequestsSnapshot = await followRequestsQuery.get();
    followRequestsSnapshot.forEach(doc => {
        console.log(`[Delete User ${userId}] Deleting follow request: ${doc.id}`);
        batch.delete(doc.ref);
    });
    
    // TODO: Add logic for other data cleanup (posts, comments, messages, vibits, etc.)
    // Examples:
    // const postsQuery = firestoreDb.collection('posts').where('authorId', '==', userId);
    // const vibitsQuery = firestoreDb.collection('vibits').where('userId', '==', userId);
    // const messagesQuery = firestoreDb.collection('messages').where('senderId', '==', userId); // Might need complex query for chats
    // ... fetch snapshots and batch delete ...

    // --- Commit the Batch --- 
    await batch.commit();
    console.log(`Successfully completed deletion cascade for user: ${userId}`);

  } catch (error) {
    console.error(`Error during deletion cascade for user ${userId}:`, error);
    // Consider adding specific error handling or logging
  }
});

// --- NEW FUNCTION: Send Live Stream Notification Emails ---

/**
 * Sends email notifications to a user's followers when they go live.
 * This function is triggered via an HTTPS callable function.
 */
exports.sendLiveNotificationEmails = onCall(async (request) => {
  initializeFirebase(); // Ensure Firebase is initialized before use
  
  // Check if the user is authenticated
  if (!request.auth) {
    throw new HttpsError(
      'unauthenticated',
      'The function must be called while authenticated.'
    );
  }

  try {
    const data = request.data;
    const { roomId, userId, userName } = data;
    
    if (!roomId || !userId) {
      throw new HttpsError(
        'invalid-argument',
        'The function requires a roomId and userId.'
      );
    }

    // Email configuration check
    const emailConfig = functions.config().email || {};
    const gmailConfig = functions.config().gmail || {};
    const senderEmail = emailConfig.user || gmailConfig.email;
    
    if (!senderEmail || !mailTransport) {
      console.error('Email transport not configured properly');
      throw new HttpsError(
        'failed-precondition',
        'Email configuration is missing or incomplete.'
      );
    }

    // Get the room details
    const roomDoc = await firestoreDb.collection('sideRooms').doc(roomId).get();
    if (!roomDoc.exists) {
      throw new HttpsError(
        'not-found',
        'The specified room does not exist.'
      );
    }
    
    const roomData = roomDoc.data();
    if (!roomData) {
      throw new HttpsError(
        'not-found',
        'The room data could not be retrieved.'
      );
    }

    // Get all followers of the user
    const followersSnapshot = await firestoreDb
      .collection('users')
      .doc(userId)
      .collection('followers')
      .get();

    if (followersSnapshot.empty) {
      console.log('No followers to notify');
      return { success: true, count: 0 };
    }

    // Get email preferences and email addresses for all followers
    const followerIds = followersSnapshot.docs.map(doc => doc.id);
    const usersSnapshot = await firestoreDb
      .collection('users')
      .where(admin.firestore.FieldPath.documentId(), 'in', followerIds)
      .get();
    
    // Filter users who have email notifications enabled and have an email
    const emailPromises = [];
    
    usersSnapshot.forEach(userDoc => {
      const userData = userDoc.data();
      // Skip if user has no email or has disabled live notifications
      if (!userData.email || (userData.emailPreferences && userData.emailPreferences.liveNotifications === false)) {
        return;
      }
      
      // Create email content
      const mailOptions = {
        from: `SideEye <${senderEmail}>`,
        to: userData.email,
        subject: `${userName} is now live on SideEye!`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1976d2;">📱 Live Stream Alert!</h2>
            <p style="font-size: 16px; color: #333;">
              <strong>${userName}</strong> just started a live stream in <strong>${roomData.name}</strong>.
            </p>
            <p style="font-size: 16px; color: #333;">
              Don't miss out! Join now to watch and interact with the stream.
            </p>
            <div style="margin: 30px 0;">
              <a href="https://sideeye.uk/side-room/${roomId}" 
                 style="background-color: #1976d2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">
                Join Stream Now
              </a>
            </div>
            <p style="font-size: 14px; color: #666; margin-top: 40px;">
              You're receiving this email because you follow ${userName} on SideEye and have enabled live notifications.
              <br><br>
              To unsubscribe from these notifications, update your email preferences in your 
              <a href="https://sideeye.uk/settings" style="color: #1976d2; text-decoration: none;">SideEye settings</a>.
            </p>
          </div>
        `
      };
      
      // Send the email
      emailPromises.push(mailTransport.sendMail(mailOptions));
    });
    
    // Wait for all emails to be sent
    await Promise.all(emailPromises);
    
    return { 
      success: true, 
      count: emailPromises.length 
    };
  } catch (error) {
    console.error('Error sending notification emails:', error);
    throw new HttpsError(
      'internal',
      'An error occurred while sending notification emails.'
    );
  }
});
