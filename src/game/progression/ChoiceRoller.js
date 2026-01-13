/**
 * Choice Roller
 * 
 * Handles rolling upgrade choices (weapons, tomes, items) for level-up and chests.
 * Uses factory pattern to inject React state dependencies.
 */

import { rollRarity, rarityMult } from "../../data/raritySystem.js";
import { pickWeighted } from "../../utils/data.js";
import { buildPreview as buildPreviewUtil, computeSpeed } from "../../utils/gameMath.js";
import { RARITY, TYPE } from "../../data/constants.js";

/**
 * Create choice rolling functions with injected dependencies
 * @param {Object} deps - Dependencies { stateRef, content, applyWeapon, pushCombatText, sfxInteract }
 * @returns {Object} Functions { rollChoicesOfType, rollLevelChoices, rollChestChoices }
 */
export function createChoiceRoller(deps) {
  const { stateRef, content, applyWeapon, pushCombatText, sfxInteract } = deps;

  function rollChoicesOfType(s, forcedType = null) {
    const p = s.player;
    const luck = p.luck;

    const choices = [];
    const used = new Set();

    const wantWeapon = !p.weapons || p.weapons.length === 0 || Math.random() < 0.18;

    for (let i = 0; i < 3; i++) {
      let safe = 0;
      while (safe++ < 90) {
        const rarity = rollRarity(luck);

        const bucket =
          forcedType ||
          pickWeighted([
            { w: wantWeapon ? 28 : 18, t: TYPE.WEAPON },
            { w: 52, t: TYPE.TOME },
            { w: 20, t: TYPE.ITEM },
          ]).t;

        let entry = null;
        if (bucket === TYPE.WEAPON) entry = pickWeighted(content.weapons.map((w) => ({ w: 1, t: w }))).t;
        else if (bucket === TYPE.TOME) entry = pickWeighted(content.tomes.map((t) => ({ w: 1, t }))).t;
        else entry = pickWeighted(content.items.map((it) => ({ w: 1, t: it }))).t;

        // Prevent same item in different rarities - only allow one version
        const itemKey = `${bucket}:${entry.id}`;
        let alreadyUsed = false;
        for (const usedKey of used) {
          if (usedKey.startsWith(itemKey)) {
            alreadyUsed = true;
            break;
          }
        }
        if (alreadyUsed) continue;

        const key = `${bucket}:${entry.id}:${rarity}`;
        used.add(key);

        // For weapon upgrades, determine upgrade type before preview
        // Use random selection from weapon-specific upgrade types
        let weaponUpgradeType = "";
        let selectedUpgradeType = null;
        if (bucket === TYPE.WEAPON) {
          const existingWeapon = s.player.weapons?.find(w => w.id === entry.id);
          if (existingWeapon) {
            const weaponId = existingWeapon.id;
            
            // Get weapon-specific upgrade cycle
            let upgradeTypes = [];
            if (weaponId === "bananarang") {
              upgradeTypes = ["range", "attackSpeed", "damage", "returnSpeed"];
            } else if (weaponId === "bone") {
              upgradeTypes = ["projectile", "damage", "attackSpeed", "rotationSpeed"];
            } else if (weaponId === "flamewalker") {
              upgradeTypes = ["radius", "damage", "attackSpeed", "duration"];
            } else if (weaponId === "poison_flask") {
              upgradeTypes = ["projectile", "damage", "attackSpeed", "splashRadius"];
            } else if (weaponId === "revolver" || weaponId === "bow" || weaponId === "lightning_staff") {
              upgradeTypes = ["projectile", "damage", "attackSpeed", "bulletSpeed"];
            } else if (existingWeapon.weaponMode === "melee") {
              upgradeTypes = ["range", "damage", "attackSpeed", "knockback"];
            } else {
              upgradeTypes = ["projectile", "damage", "attackSpeed", "bulletSpeed"];
            }
            
            // Randomly select upgrade type
            const upgradeType = upgradeTypes[Math.floor(Math.random() * upgradeTypes.length)];
            selectedUpgradeType = upgradeType;
            
            // Generate description text for upgrade type
            if (upgradeType === "projectile") {
              weaponUpgradeType = "+1 Projectile";
            } else if (upgradeType === "damage") {
              weaponUpgradeType = "+6% Damage";
            } else if (upgradeType === "attackSpeed") {
              weaponUpgradeType = "+4% Attack Speed";
            } else if (upgradeType === "bulletSpeed") {
              weaponUpgradeType = "+4% Projectile Speed";
            } else if (upgradeType === "range") {
              if (weaponId === "bananarang") {
                weaponUpgradeType = "+30 Range";
              } else {
                weaponUpgradeType = "+8% Melee Range";
              }
            } else if (upgradeType === "returnSpeed") {
              weaponUpgradeType = "+15% Return Speed";
            } else if (upgradeType === "rotationSpeed") {
              weaponUpgradeType = "+20% Rotation Speed";
            } else if (upgradeType === "radius") {
              weaponUpgradeType = "+10% Aura Radius";
            } else if (upgradeType === "duration") {
              weaponUpgradeType = "+15% Burn Duration";
            } else if (upgradeType === "splashRadius") {
              weaponUpgradeType = "+12% Splash Radius";
            } else if (upgradeType === "knockback") {
              weaponUpgradeType = "+20% Knockback";
            }
          }
        }

        // Pass weapon ID and upgrade type for weapon-specific previews
        const previewWeaponId = bucket === TYPE.WEAPON ? entry.id : null;
        // Don't generate preview for tomes/items that will have detailedDesc (to avoid duplication)
        const itemsWithDetailedDesc = ["t_xp", "t_crit_master", "t_elemental", "t_speed_demon", "t_hp", "t_berserker", "moldy_cheese", "ice_crystal", "speed_boots", "slurp_gloves"];
        const shouldGeneratePreview = bucket === TYPE.WEAPON || !itemsWithDetailedDesc.includes(entry.id);
        let preview = shouldGeneratePreview ? buildPreviewUtil(s.player, (pp) => {
          if (bucket === TYPE.WEAPON) applyWeapon(pp, entry, rarity, true, selectedUpgradeType);
          else if (bucket === TYPE.TOME) entry.apply(pp, rarity);
        }, computeSpeed, previewWeaponId, selectedUpgradeType) : "";

        // Generate detailed description with exact amounts based on rarity
        let detailedDesc = entry.desc || (bucket === TYPE.WEAPON ? "Equip or upgrade your weapon" : "");
            if (bucket === TYPE.WEAPON) {
          // Generate description for weapon upgrade
          const existingWeapon = s.player.weapons?.find(w => w.id === entry.id);
          if (existingWeapon) {
            // Show what will be upgraded
            const m = rarityMult(rarity);
            const levelBonus = existingWeapon.level || 1;
            const nextLevel = levelBonus + 1;
            
            detailedDesc = `Level ${nextLevel} ${entry.name} (${rarity})`;
            if (weaponUpgradeType) {
              detailedDesc += `\n${weaponUpgradeType}`;
            }
            // Add preview info from buildPreview
            if (preview) {
              detailedDesc += `\n${preview}`;
            }
          } else {
            detailedDesc = `New: ${entry.name} (${rarity})`;
          }
        } else if (bucket === TYPE.TOME && entry.apply) {
          const m = rarityMult(rarity);
          // Calculate exact amounts for common tomes
          if (entry.id === "t_damage") {
            const percent = Math.round(6 * m * 10) / 10;
            detailedDesc = `+${percent}% Damage to all weapons (${rarity})`;
          } else if (entry.id === "t_cooldown") {
            const percent = Math.round(8 * m);
            detailedDesc = `-${percent}% Attack Cooldown (${rarity})`;
          } else if (entry.id === "t_quantity") {
            let projectilesToAdd = 1;
            if (rarity === RARITY.UNCOMMON || rarity === RARITY.RARE) {
              projectilesToAdd = 2;
            } else if (rarity === RARITY.LEGENDARY) {
              projectilesToAdd = 3;
            }
            detailedDesc = `+${projectilesToAdd} Projectile${projectilesToAdd > 1 ? 's' : ''} (${rarity})`;
          } else if (entry.id === "t_precision") {
            const amount = Math.round(4 * m * 100) / 100;
            detailedDesc = `+${amount}% Crit Chance (${rarity})`;
          } else if (entry.id === "t_hp") {
            const amount = Math.round(8 * m);
            detailedDesc = `+${amount} Max HP (${rarity})`;
          } else if (entry.id === "t_regen") {
            const amount = Math.round(55 * m * 100) / 100;
            detailedDesc = `+${amount} HP Regen (${rarity})`;
          } else if (entry.id === "t_gold") {
            const percent = Math.round(12 * m);
            detailedDesc = `+${percent}% Gold Gain (${rarity})`;
          } else if (entry.id === "t_luck") {
            const amount = Math.round(32 * m * 100) / 100;
            detailedDesc = `+${amount} Luck (${rarity})`;
          } else if (entry.id === "t_xp") {
            const percent = Math.round(6 * m * 10) / 10;
            detailedDesc = `+${percent}% XP Gain (${rarity})`;
          } else if (entry.id === "t_crit_master") {
            const critChance = Math.round(2.5 * m * 100) / 100;
            const critDamage = Math.round(0.3 * m * 100) / 100;
            detailedDesc = `+${critChance}% Crit Chance\n+${critDamage}x Crit Damage (${rarity})`;
          } else if (entry.id === "t_elemental") {
            const percent = Math.round(12 * m);
            detailedDesc = `+${percent}% Chance for random elemental effect (${rarity})\n(Burn, Shock, Poison, or Freeze)`;
          } else if (entry.id === "t_speed_demon") {
            const speedMult = Math.round(0.05 * m * 100) / 100;
            detailedDesc = `+${speedMult}x Damage per unit of Speed (${rarity})`;
          } else if (entry.id === "t_bounce") {
            const bounceAdd = m < 1.2 ? 1 : m < 1.4 ? 2 : 3;
            detailedDesc = `+${bounceAdd} Bounce to all weapons (${rarity})`;
          } else if (entry.id === "t_agility") {
            const amount = Math.round(14 * m);
            detailedDesc = `+${amount} Movement Speed (${rarity})`;
          } else if (entry.id === "t_berserker") {
            const hpReduction = Math.round(15 * m);
            const damageMult = Math.round(0.10 * m * 100) / 100;
            detailedDesc = `-${hpReduction}% Max HP (${rarity})\n+${damageMult}x Damage per % missing HP\n(Up to ${Math.round(100 * damageMult)}% bonus at 0% HP)`;
          }
        } else if (bucket === TYPE.ITEM && entry.apply) {
          const m = rarityMult(rarity);
          // Calculate exact amounts for items
          if (entry.id === "moldy_cheese") {
            const percent = Math.round(6 * m * 100) / 100;
            detailedDesc = `+${percent}% Poison Chance on Hit (${rarity})\nPoison: 30% of damage as DPS for 2.4s`;
          } else if (entry.id === "ice_crystal") {
            const chance = Math.round((0.2 + 0.15 * m) * 100);
            const radius = Math.round(35 + 15 * m);
            const duration = Math.round((1.4 + 0.4 * m) * 10) / 10;
            detailedDesc = `${chance}% Chance to Freeze (${rarity})\nRange: ${radius}px\nDuration: ${duration}s`;
          } else if (entry.id === "speed_boots") {
            const amount = Math.round(12 * m);
            detailedDesc = `+${amount} Movement Speed (${rarity})`;
          } else if (entry.id === "slurp_gloves") {
            const percent = Math.round(6 * m * 100) / 100;
            detailedDesc = `+${percent}% Lifesteal (${rarity})`;
          }
        }

        // Create apply function with proper closure and error handling
        // Capture the upgrade type in the closure
        const capturedUpgradeType = selectedUpgradeType;
        const applyFn = () => {
          try {
            const currentState = stateRef.current;
            if (!currentState) return;
            
            if (bucket === TYPE.WEAPON) {
              const p = currentState.player;
              const existingWeapon = p.weapons?.find(w => w.id === entry.id);
              const beforeDmg = existingWeapon ? existingWeapon.weaponDamage : 0;
              const beforeProj = existingWeapon ? existingWeapon.projectiles : 0;
              const beforeCd = existingWeapon ? existingWeapon.attackCooldown : 0;
              
              // Use the captured upgrade type
              applyWeapon(p, entry, rarity, false, capturedUpgradeType);
              
              // Show feedback for what was upgraded
              if (existingWeapon) {
                const afterDmg = existingWeapon.weaponDamage;
                const afterProj = existingWeapon.projectiles;
                const afterCd = existingWeapon.attackCooldown;
                
                if (Math.abs(afterDmg - beforeDmg) > 0.1) {
                  const dmgIncrease = Math.round((afterDmg - beforeDmg) * 10) / 10;
                  pushCombatText(currentState, p.x, p.y - 30, `+${dmgIncrease} Damage`, "#2ea8ff", { size: 13, life: 1.0 });
                }
                if (afterProj > beforeProj) {
                  pushCombatText(currentState, p.x, p.y - 45, `+${afterProj - beforeProj} Projectile`, "#ffd44a", { size: 13, life: 1.0 });
                }
                if (Math.abs(beforeCd - afterCd) > 0.01) {
                  const cdReduction = Math.round((beforeCd - afterCd) * 100) / 100;
                  pushCombatText(currentState, p.x, p.y - 60, `-${cdReduction}s Cooldown`, "#1fe06a", { size: 13, life: 1.0 });
                }
              } else {
                // New weapon
                pushCombatText(currentState, p.x, p.y - 30, `NEW: ${entry.name}`, "#ffd44a", { size: 14, life: 1.2 });
              }
              
              // Track collected weapon
              if (!p.collectedWeapons) p.collectedWeapons = [];
              if (!p.collectedWeapons.find(w => w.id === entry.id)) {
                p.collectedWeapons.push({ id: entry.id, name: entry.name, icon: entry.icon });
              }
              sfxInteract();
            } else if (bucket === TYPE.TOME) {
              const p = currentState.player;
              const beforeDmg = p.weapons ? p.weapons.reduce((sum, w) => sum + w.weaponDamage, 0) : 0;
              const beforeCrit = p.critChance;
              const beforeHp = p.maxHp;
              const beforeSpeed = p.speedBase + p.speedBonus;
              
              entry.apply(p, rarity);
              
              // Show feedback for what was upgraded
              if (entry.id === "t_damage") {
                const afterDmg = p.weapons ? p.weapons.reduce((sum, w) => sum + w.weaponDamage, 0) : 0;
                const dmgIncrease = Math.round((afterDmg - beforeDmg) * 10) / 10;
                if (dmgIncrease > 0.1) {
                  pushCombatText(currentState, p.x, p.y - 30, `+${dmgIncrease} Total Damage`, "#2ea8ff", { size: 13, life: 1.0 });
                }
              } else if (entry.id === "t_precision") {
                const critIncrease = Math.round((p.critChance - beforeCrit) * 100 * 10) / 10;
                if (critIncrease > 0.1) {
                  pushCombatText(currentState, p.x, p.y - 30, `+${critIncrease}% Crit`, "#ffd44a", { size: 13, life: 1.0 });
                }
              } else if (entry.id === "t_hp") {
                const hpIncrease = Math.round(p.maxHp - beforeHp);
                if (hpIncrease > 0) {
                  pushCombatText(currentState, p.x, p.y - 30, `+${hpIncrease} Max HP`, "#1fe06a", { size: 13, life: 1.0 });
                }
              } else if (entry.id === "t_agility") {
                const speedIncrease = Math.round((p.speedBase + p.speedBonus) - beforeSpeed);
                if (speedIncrease > 0) {
                  pushCombatText(currentState, p.x, p.y - 30, `+${speedIncrease} Speed`, "#c23bff", { size: 13, life: 1.0 });
                }
              } else if (entry.id === "t_quantity") {
                // Show feedback for quantity tome
                const m = rarityMult(rarity);
                let projectilesToAdd = 1;
                if (rarity === RARITY.UNCOMMON || rarity === RARITY.RARE) {
                  projectilesToAdd = 2;
                } else if (rarity === RARITY.LEGENDARY) {
                  projectilesToAdd = 3;
                }
                pushCombatText(currentState, p.x, p.y - 30, `+${projectilesToAdd} Projectile${projectilesToAdd > 1 ? 's' : ''}`, "#ffd44a", { size: 13, life: 1.0 });
              } else {
                pushCombatText(currentState, p.x, p.y - 30, `${entry.name}`, "#2ea8ff", { size: 13, life: 1.0 });
              }
              
              // Track collected tome
              if (!p.collectedTomes) p.collectedTomes = [];
              if (!p.collectedTomes.find(t => t.id === entry.id)) {
                p.collectedTomes.push({ id: entry.id, name: entry.name, icon: entry.icon });
              }
              sfxInteract();
            } else {
              entry.apply(currentState, rarity);
              // Track collected item
              if (!currentState.player.collectedItems) currentState.player.collectedItems = [];
              if (!currentState.player.collectedItems.find(it => it.id === entry.id)) {
                currentState.player.collectedItems.push({ id: entry.id, name: entry.name, icon: entry.icon });
              }
              sfxInteract();
            }
          } catch (error) {
            console.error("Error applying upgrade:", error, entry);
            // Still continue even if there's an error
            sfxInteract();
          }
        };
        
        // Don't show preview if we have a detailedDesc (and it's different from base desc) to avoid duplication
        const hasDetailedDesc = detailedDesc && detailedDesc !== entry.desc && detailedDesc !== (bucket === TYPE.WEAPON ? "Equip or upgrade your weapon" : "");
        const finalPreview = hasDetailedDesc ? "" : preview;
        
        choices.push({
          rarity,
          type: bucket,
          id: entry.id,
          name: entry.name,
          desc: detailedDesc,
          icon: entry.icon,
          preview: finalPreview,
          apply: applyFn,
          weaponUpgradeType: selectedUpgradeType, // Store the selected upgrade type
        });

        break;
      }
    }

    return choices;
  }

  function rollLevelChoices(s) {
    return rollChoicesOfType(s, null);
  }

  function rollChestChoices(s) {
    const bucket = pickWeighted([
      { w: 26, t: TYPE.WEAPON },
      { w: 50, t: TYPE.TOME },
      { w: 24, t: TYPE.ITEM },
    ]).t;
    return { bucket, choices: rollChoicesOfType(s, bucket) };
  }

  return {
    rollChoicesOfType,
    rollLevelChoices,
    rollChestChoices,
  };
}
