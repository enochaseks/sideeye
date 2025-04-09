/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const {onCall} = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

// exports.helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });

// Initialize admin app
const app = admin.initializeApp();

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
  if (!request.auth) {
    throw new Error("The function must be called while authenticated.");
  }

  const {displayName, bio, profilePic} = request.data;
  const userId = request.auth.uid;

  try {
    await app.firestore().collection("users").doc(userId).update({
      displayName,
      bio,
      profilePic,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {success: true};
  } catch (error) {
    console.error("Error updating profile:", error);
    throw new Error("An error occurred while updating the profile.");
  }
});
