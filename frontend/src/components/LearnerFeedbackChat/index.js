import { useEffect, useState } from "react";
import Card from "@mui/material/Card";
import Icon from "@mui/material/Icon";
import Badge from "@mui/material/Badge";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import MDInput from "components/MDInput";
import { apiClient } from "lib/api";

function formatTime(value) {
  return value
    ? new Date(value).toLocaleString("en-US", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";
}

function LearnerFeedbackChat() {
  const [visible, setVisible] = useState(() => localStorage.getItem("feedbackHidden") !== "true");
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [unreadReplies, setUnreadReplies] = useState(0);

  const loadUnread = async () => {
    try {
      const response = await apiClient.get("/feedback/learner/unread");
      const nextUnread = response.unread_replies || 0;
      setUnreadReplies(nextUnread);
      window.dispatchEvent(
        new CustomEvent("educlub:feedback-unread-value", {
          detail: { unread: nextUnread },
        })
      );
    } catch (err) {
      setError(err.message || "Could not check feedback replies.");
    }
  };

  const loadThread = async () => {
    try {
      const response = await apiClient.get("/feedback/learner/thread");
      setMessages(response.messages || []);
      setUnreadReplies(0);
      window.dispatchEvent(new CustomEvent("educlub:feedback-unread-changed"));
    } catch (err) {
      setError(err.message || "Could not load feedback.");
    }
  };

  useEffect(() => {
    if (!visible) {
      return undefined;
    }

    loadUnread();
    const interval = setInterval(loadUnread, 2 * 60 * 1000);

    return () => clearInterval(interval);
  }, [visible]);

  useEffect(() => {
    if (open) {
      loadThread();
    }
  }, [open]);

  useEffect(() => {
    const openChat = () => {
      localStorage.setItem("feedbackHidden", "false");
      setVisible(true);
      setOpen(true);
    };

    window.addEventListener("educlub:open-feedback-chat", openChat);
    return () => window.removeEventListener("educlub:open-feedback-chat", openChat);
  }, []);

  const hideButton = () => {
    localStorage.setItem("feedbackHidden", "true");
    setVisible(false);
  };

  const send = async () => {
    setError("");
    setSending(true);
    try {
      await apiClient.post("/feedback/learner/messages", { message });
      setMessage("");
      await loadThread();
      window.dispatchEvent(new CustomEvent("educlub:feedback-unread-changed"));
    } catch (err) {
      setError(err.message || "Could not send feedback.");
    } finally {
      setSending(false);
    }
  };

  if (!visible) {
    return null;
  }

  return (
    <MDBox position="fixed" right={18} bottom={18} zIndex={1300}>
      {open && (
        <Card sx={{ width: { xs: 310, sm: 360 }, mb: 1.5, overflow: "hidden" }}>
          <MDBox
            px={2}
            py={1.5}
            display="flex"
            justifyContent="space-between"
            alignItems="center"
            bgColor="info"
          >
            <MDTypography variant="button" color="white" fontWeight="bold">
              eduClub Feedback
            </MDTypography>
            <MDButton variant="text" color="white" size="small" onClick={() => setOpen(false)}>
              <Icon fontSize="small">close</Icon>
            </MDButton>
          </MDBox>
          <MDBox p={1.5} height="260px" sx={{ overflowY: "auto", backgroundColor: "#f8fafc" }}>
            {messages.length === 0 ? (
              <MDTypography variant="caption" color="text">
                Send feedback or ask for help. Replies from eduClub will appear here.
              </MDTypography>
            ) : (
              messages.map((item) => {
                const own = item.sender_role === "learner";
                return (
                  <MDBox
                    key={item.id}
                    display="flex"
                    justifyContent={own ? "flex-end" : "flex-start"}
                    mb={1}
                  >
                    <MDBox
                      maxWidth="82%"
                      px={1.5}
                      py={1}
                      borderRadius="md"
                      sx={{
                        backgroundColor: own ? "#1A73E8" : "#ffffff",
                        border: own ? "none" : "1px solid #e5e7eb",
                      }}
                    >
                      <MDTypography
                        variant="caption"
                        color={own ? "white" : "text"}
                        display="block"
                      >
                        {item.message}
                      </MDTypography>
                      <MDTypography variant="caption" color={own ? "white" : "secondary"}>
                        {formatTime(item.created_at)}
                      </MDTypography>
                    </MDBox>
                  </MDBox>
                );
              })
            )}
          </MDBox>
          <MDBox p={1.5}>
            {error && (
              <MDTypography variant="caption" color="error" display="block" mb={1}>
                {error}
              </MDTypography>
            )}
            <MDInput
              label="Write feedback"
              fullWidth
              multiline
              minRows={2}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <MDButton
              variant="gradient"
              color="info"
              fullWidth
              sx={{ mt: 1 }}
              disabled={sending || !message.trim()}
              onClick={send}
            >
              {sending ? "Sending..." : "Send"}
            </MDButton>
          </MDBox>
        </Card>
      )}

      <MDBox display="flex" justifyContent="flex-end" alignItems="center" gap={0.75}>
        <MDButton
          variant="text"
          color="dark"
          size="small"
          onClick={hideButton}
          sx={{ minWidth: 28, width: 28, height: 28, p: 0, borderRadius: "50%" }}
        >
          <Icon fontSize="small">close</Icon>
        </MDButton>
        <Badge badgeContent={unreadReplies} color="error">
          <MDButton
            variant="gradient"
            color="info"
            onClick={() => setOpen((value) => !value)}
            sx={{ minWidth: 46, width: 46, height: 46, p: 0, borderRadius: "50%" }}
          >
            <Icon>chat</Icon>
          </MDButton>
        </Badge>
      </MDBox>
    </MDBox>
  );
}

export default LearnerFeedbackChat;
