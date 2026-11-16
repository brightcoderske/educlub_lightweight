import { apiClient } from "lib/api";

// The signed-in learner's own record. The API already limits a learner to
// their own row, so no filter is sent: filtering by the session's email used to
// find nothing once the learner changed their address, which emptied the
// profile and progress pages until they signed in again.
export async function fetchOwnLearner() {
  const learners = await apiClient.get("/learners");
  return Array.isArray(learners) ? learners[0] || null : null;
}
