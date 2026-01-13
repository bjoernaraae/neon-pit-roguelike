import { clamp, rand } from "../../utils/math.js";
import { bumpShake, addParticle } from "../effects/VisualEffects.js";
import { pushCombatText as pushCombatTextFn } from "../effects/CombatText.js";

/**
 * Find the nearest interactable object within interaction range
 */
export function nearestInteractable(s) {
  const p = s.player;
  let best = null;
  let bestD = Infinity;

  for (const it of s.interact) {
    if (it.used) continue;
    const d = Math.hypot(p.x - it.x, p.y - it.y);
    if (d < bestD) {
      bestD = d;
      best = it;
    }
  }

  return best && bestD <= 52 ? best : null;
}

/**
 * Attempt to use the nearest interactable (chest, shrine, portal, etc.)
 */
export function tryUseInteractable(s, INTERACT, triggerUpgradeSequenceFn, startBossFn, sfxInteractFn, content, uiRef) {
  const p = s.player;
  const best = nearestInteractable(s);
  if (!best) return;

  // Calculate dynamic cost for boss portal (percentage of current gold)
  let actualCost = best.cost;
  if (best.kind === INTERACT.BOSS_TP && best.cost === -1) {
    const percentageCost = Math.round(p.coins * 0.2);
    actualCost = Math.max(100, percentageCost);
  }

  if (actualCost > 0 && p.coins < actualCost) {
    pushCombatTextFn(s, p.x, p.y - 24, `Need ${actualCost}`, "#ffd44a", { size: 12, life: 0.7 });
    return;
  }
  if (actualCost > 0) p.coins -= actualCost;

  best.used = true;
  sfxInteractFn();

  if (best.kind === INTERACT.CHEST) {
    s.chestOpens += 1;
    // Removed "CHEST OPENED" text to avoid blocking upgrade display
    s.interact = s.interact.filter((x) => x.id !== best.id);
    // Preserve explosive bullets (injected or seeking) and boomerang bullets when opening chest
    s.bullets = s.bullets.filter(b => 
      (b.explosive && ((b.injected && b.injectedEnemy) || (b.seeking && !b.injected))) ||
      (b.boomerang && b.t < b.life)
    );

    // DELETE random upgrade logic - use triggerUpgradeSequence instead
    triggerUpgradeSequenceFn(s, content);
    s.running = false;
    s.freezeMode = "levelup";

    s.chestSpawnT = 28 + rand(0, 18);
    return;
  }

  if (best.kind === INTERACT.SHRINE) {
    // Shrine repurposed as permanent buff station - gives small permanent stat boost
    // Can be used multiple times, but with diminishing returns
    const statBoost = 0.02; // 2% permanent boost
    p.weaponDamage = (p.weaponDamage || 1) * (1 + statBoost);
    p.maxHp = Math.round((p.maxHp || 100) * (1 + statBoost));
    p.hp = Math.min(p.maxHp, p.hp + Math.round(p.maxHp * statBoost));
    bumpShake(s, 2, 0.06);
    addParticle(s, p.x, p.y, 20, 200, { size: 3, speed: 1.2 });
    pushCombatTextFn(s, p.x, p.y - 30, "+2% STATS", "#ffd44a", { size: 16, life: 1.2 });
    // Shrine doesn't disappear - can be used multiple times
    return;
  }

  if (best.kind === INTERACT.MICROWAVE) {
    // Microwave repurposed as permanent HP boost station
    const hpBoost = Math.round(p.maxHp * 0.05); // 5% max HP boost
    p.maxHp = Math.round(p.maxHp + hpBoost);
    p.hp = Math.min(p.maxHp, p.hp + hpBoost);
    addParticle(s, p.x, p.y, 18, 160);
    pushCombatTextFn(s, p.x, p.y - 30, `+${hpBoost} MAX HP`, "#4dff88", { size: 16, life: 1.2 });
    // Microwave doesn't disappear - can be used multiple times
    return;
  }

  if (best.kind === INTERACT.GREED) {
    p.difficultyTome *= 1.15;
    s.spawn.delay = Math.max(0.26, s.spawn.delay * 0.92);
    pushCombatTextFn(s, p.x, p.y - 30, "GREED SHRINE", "#ffd44a", { size: 16, life: 1.2 });
    s.interact = s.interact.filter((x) => x.id !== best.id);
    return;
  }

  if (best.kind === INTERACT.BOSS_TP) {
    // Store boss teleporter position for boss spawn
    const u = uiRef.current;
    u.bossTpX = best.x;
    u.bossTpY = best.y;
    s.interact = s.interact.filter((x) => x.id !== best.id);
    if (!s.boss.active) {
      startBossFn(s, 120, best.x, best.y); // Spawn boss at teleporter location
      s.bossPortalSpawned = false; // Reset for next floor
    }
  }
}
