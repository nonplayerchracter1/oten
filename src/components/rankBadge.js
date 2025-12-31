// rankBadge.js
import React from "react";
import { getRankImageUrl, getRankStyle } from "./rank_images";

const RankBadge = ({ rank, showImage = true, size = "medium" }) => {
  if (!rank) return null;

  const rankImageUrl = getRankImageUrl(rank);
  const rankStyle = getRankStyle(rank);

  // Adjust size based on prop
  const sizeStyles = {
    small: {
      padding: "2px 8px",
      fontSize: "10px",
      imageSize: "16px",
    },
    medium: {
      padding: "4px 12px",
      fontSize: "12px",
      imageSize: "20px",
    },
    large: {
      padding: "6px 16px",
      fontSize: "14px",
      imageSize: "24px",
    },
  };

  const selectedSize = sizeStyles[size] || sizeStyles.medium;

  const finalStyle = {
    ...rankStyle,
    padding: selectedSize.padding,
    fontSize: selectedSize.fontSize,
  };

  return (
    <div style={finalStyle} className="rank-badge">
      {showImage && rankImageUrl && (
        <img
          src={rankImageUrl}
          alt={`${rank} rank`}
          style={{
            width: selectedSize.imageSize,
            height: selectedSize.imageSize,
            borderRadius: "50%",
            objectFit: "cover",
            border: "1px solid rgba(255,255,255,0.3)",
          }}
          onError={(e) => {
            // If image fails to load, hide it
            e.target.style.display = "none";
          }}
        />
      )}
      <span>{rank}</span>
    </div>
  );
};

export default RankBadge;
