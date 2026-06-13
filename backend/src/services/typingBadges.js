const BADGES = {
  starter: { tier: "starter", label: "Typing Starter", color: "#64748b" },
  speed_builder: { tier: "speed_builder", label: "Speed Builder", color: "#b87333" },
  keyboard_pro: { tier: "keyboard_pro", label: "Keyboard Pro", color: "#64748b" },
  typing_champion: { tier: "typing_champion", label: "Typing Champion", color: "#d4af37" },
};

function getTypingBadge(netWpm, accuracy) {
  const speed = Number(netWpm || 0);
  const precision = Number(accuracy || 0);

  if (speed >= 45 && precision >= 95) return BADGES.typing_champion;
  if (speed >= 30 && precision >= 95) return BADGES.keyboard_pro;
  if (speed >= 15) return BADGES.speed_builder;
  return BADGES.starter;
}

module.exports = { getTypingBadge };
