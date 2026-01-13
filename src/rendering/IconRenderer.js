/**
 * Icon Renderer
 * 
 * Canvas-based icon drawing functions for weapons and items.
 * Each function draws a simple geometric representation of the item.
 */

/**
 * Create an icon drawing function for a specific item type
 * @param {string} kind - Icon type identifier
 * @returns {Function} Drawing function (ctx, x, y, size) => void
 */
export function makeIconDraw(kind) {
  if (kind === "revolver")
    return (ctx, x, y, s) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(-0.2);
      ctx.globalAlpha = 0.95;
      ctx.fillRect(-s * 0.65, -s * 0.25, s * 1.3, s * 0.5);
      ctx.fillRect(s * 0.2, -s * 0.15, s * 0.7, s * 0.3);
      ctx.restore();
    };
  
  if (kind === "staff")
    return (ctx, x, y, s) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(0.6);
      ctx.fillRect(-s * 0.15, -s * 0.8, s * 0.3, s * 1.6);
      ctx.beginPath();
      ctx.arc(0, -s * 0.8, s * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };
  
  if (kind === "sword")
    return (ctx, x, y, s) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(-0.7);
      ctx.fillRect(-s * 0.08, -s * 0.8, s * 0.16, s * 1.35);
      ctx.fillRect(-s * 0.35, s * 0.25, s * 0.7, s * 0.18);
      ctx.restore();
    };
  
  if (kind === "time")
    return (ctx, x, y, s) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.75, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -s * 0.45);
      ctx.lineTo(s * 0.35, -s * 0.2);
      ctx.stroke();
      ctx.restore();
    };
  
  if (kind === "nuke")
    return (ctx, x, y, s) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(0.15);
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        const rr = i % 2 === 0 ? s * 0.8 : s * 0.35;
        ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    };
  
  // Default icon: simple circle
  return (ctx, x, y, s) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };
}
