import { useCallback, useEffect, useState } from "react";
import PropTypes from "prop-types";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import Icon from "@mui/material/Icon";
import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import MDInput from "components/MDInput";
import MDTypography from "components/MDTypography";
import { apiClient } from "lib/api";

const adminMessageRoles = ["system_admin", "school_admin", "teacher"];

function AdminFeedbackPanel({ title = "Learner Feedback" }) {
  const [threads, setThreads] = useState([]);
  const [selectedThread, setSelectedThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [reply, setReply] = useState("");
  const [error, setError] = useState("");

  const loadThreads = useCallback(async () => {
    const response = await apiClient.get("/feedback/admin/threads");
    setThreads(response);
    return response;
  }, []);

  useEffect(() => {
    let active = true;

    const refresh = async () => {
      try {
        const response = await apiClient.get("/feedback/admin/threads");
        if (active) setThreads(response);
      } catch (err) {
        if (active) setError(err.message || "Could not load learner messages.");
      }
    };

    refresh();
    const interval = setInterval(refresh, 60 * 1000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const openThread = async (thread) => {
    setError("");
    setSelectedThread(thread);
    try {
      const response = await apiClient.get(`/feedback/admin/threads/${thread.id}`);
      setSelectedThread(response.thread);
      setMessages(response.messages || []);
      setThreads((current) =>
        current.map((item) => (item.id === thread.id ? { ...item, unread_messages: 0 } : item))
      );
    } catch (err) {
      setError(err.message || "Could not open feedback thread.");
    }
  };

  const sendReply = async () => {
    if (!selectedThread || !reply.trim()) {
      return;
    }

    setError("");
    try {
      await apiClient.post(`/feedback/admin/threads/${selectedThread.id}/messages`, {
        message: reply,
      });
      setReply("");
      await openThread(selectedThread);
      await loadThreads();
    } catch (err) {
      setError(err.message || "Could not send reply.");
    }
  };

  const formatTime = (value) =>
    value
      ? new Date(value).toLocaleString("en-US", {
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "";

  return (
    <Card>
      <MDBox p={3}>
        <MDBox display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <MDTypography variant="h5" fontWeight="bold">
            {title}
          </MDTypography>
          <MDButton
            variant="text"
            color="info"
            onClick={() => loadThreads().catch((err) => setError(err.message))}
          >
            Refresh
          </MDButton>
        </MDBox>
        {error && (
          <MDTypography variant="caption" color="error" display="block" mb={1}>
            {error}
          </MDTypography>
        )}
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <MDBox height="360px" sx={{ overflowY: "auto" }}>
              {threads.length === 0 ? (
                <MDTypography variant="body2" color="text">
                  No learner feedback yet.
                </MDTypography>
              ) : (
                threads.map((thread) => (
                  <MDBox
                    key={thread.id}
                    p={1.5}
                    mb={1}
                    borderRadius="md"
                    sx={{
                      cursor: "pointer",
                      border:
                        selectedThread?.id === thread.id
                          ? "1px solid #1A73E8"
                          : "1px solid #e5e7eb",
                      backgroundColor: selectedThread?.id === thread.id ? "#eef5ff" : "#ffffff",
                    }}
                    onClick={() => openThread(thread)}
                  >
                    <MDBox display="flex" justifyContent="space-between" alignItems="center">
                      <MDTypography variant="button" fontWeight="bold">
                        {thread.learner_name || "Learner"}
                      </MDTypography>
                      {thread.unread_messages > 0 && (
                        <MDBox
                          minWidth="22px"
                          height="22px"
                          borderRadius="50%"
                          bgColor="error"
                          display="flex"
                          alignItems="center"
                          justifyContent="center"
                        >
                          <MDTypography variant="caption" color="white">
                            {thread.unread_messages}
                          </MDTypography>
                        </MDBox>
                      )}
                    </MDBox>
                    <MDTypography variant="caption" color="text" display="block">
                      {thread.school_name || "No school"} | {formatTime(thread.last_message_at)}
                    </MDTypography>
                    <MDTypography variant="caption" color="text" display="block">
                      {thread.last_message || "No messages yet."}
                    </MDTypography>
                  </MDBox>
                ))
              )}
            </MDBox>
          </Grid>
          <Grid item xs={12} md={8}>
            <MDBox height="360px" display="flex" flexDirection="column">
              <MDBox
                flex={1}
                p={1.5}
                borderRadius="md"
                sx={{ overflowY: "auto", backgroundColor: "#f8fafc" }}
              >
                {!selectedThread ? (
                  <MDTypography variant="body2" color="text">
                    Select a learner conversation to read or reply.
                  </MDTypography>
                ) : (
                  messages.map((message) => {
                    const admin = adminMessageRoles.includes(message.sender_role);
                    return (
                      <MDBox
                        key={message.id}
                        display="flex"
                        justifyContent={admin ? "flex-end" : "flex-start"}
                        mb={1}
                      >
                        <MDBox
                          maxWidth="78%"
                          px={1.5}
                          py={1}
                          borderRadius="md"
                          sx={{
                            backgroundColor: admin ? "#1A73E8" : "#ffffff",
                            border: admin ? "none" : "1px solid #e5e7eb",
                          }}
                        >
                          <MDTypography
                            variant="caption"
                            color={admin ? "white" : "text"}
                            display="block"
                          >
                            {message.message}
                          </MDTypography>
                          <MDTypography variant="caption" color={admin ? "white" : "secondary"}>
                            {formatTime(message.created_at)}
                          </MDTypography>
                        </MDBox>
                      </MDBox>
                    );
                  })
                )}
              </MDBox>
              <MDBox display="flex" gap={1} mt={1.5}>
                <MDInput
                  label="Reply"
                  fullWidth
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  disabled={!selectedThread}
                />
                <MDButton
                  variant="gradient"
                  color="info"
                  onClick={sendReply}
                  disabled={!selectedThread || !reply.trim()}
                >
                  <Icon>send</Icon>
                </MDButton>
              </MDBox>
            </MDBox>
          </Grid>
        </Grid>
      </MDBox>
    </Card>
  );
}

AdminFeedbackPanel.propTypes = {
  title: PropTypes.string,
};

export default AdminFeedbackPanel;
