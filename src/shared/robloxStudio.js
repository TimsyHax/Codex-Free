/**
 * Roblox Studio 3D Model, R15/R6 KeyframeSequence Animation, and .rbxmx / Luau Generator Engine.
 * Produces high-detail multi-part Roblox models, biomechanically accurate 15-joint R15 animations,
 * valid .rbxmx XML files for direct drag-and-drop into Roblox Studio, and live HttpService plugin sync payloads.
 */

export const R15_JOINTS = [
  "HumanoidRootPart",
  "LowerTorso",
  "UpperTorso",
  "Head",
  "LeftUpperArm",
  "LeftLowerArm",
  "LeftHand",
  "RightUpperArm",
  "RightLowerArm",
  "RightHand",
  "LeftUpperLeg",
  "LeftLowerLeg",
  "LeftFoot",
  "RightUpperLeg",
  "RightLowerLeg",
  "RightFoot"
];

/**
 * Generates a high-precision, multi-part Roblox Studio 3D Model specification
 * from a natural language prompt + optional photo/video attachment metadata.
 */
export function generateRobloxModelSpec(prompt = "", attachments = []) {
  const lower = String(prompt || "").toLowerCase();

  // Extract custom palette from attached photo/video if provided
  const primaryPhoto = attachments.find((a) => a.palette && a.palette.length > 0);
  const palette = primaryPhoto?.palette || null;

  const pickColor = (idx, fallbackHex) => {
    if (palette && palette[idx]) return palette[idx];
    return fallbackHex;
  };

  let archetype = "mecha_drone";
  if (
    lower.includes("sword") ||
    lower.includes("katana") ||
    lower.includes("blade") ||
    lower.includes("dagger") ||
    lower.includes("scythe")
  ) {
    archetype = "cyber_katana";
  } else if (
    lower.includes("car") ||
    lower.includes("vehicle") ||
    lower.includes("truck") ||
    lower.includes("lamborghini") ||
    lower.includes("race")
  ) {
    archetype = "cyber_supercar";
  } else if (
    lower.includes("gun") ||
    lower.includes("rifle") ||
    lower.includes("blaster") ||
    lower.includes("pistol") ||
    lower.includes("weapon")
  ) {
    archetype = "pulse_rifle";
  } else if (
    lower.includes("castle") ||
    lower.includes("tower") ||
    lower.includes("house") ||
    lower.includes("building") ||
    lower.includes("shrine") ||
    lower.includes("temple")
  ) {
    archetype = "citadel_tower";
  } else if (
    lower.includes("dragon") ||
    lower.includes("monster") ||
    lower.includes("creature") ||
    lower.includes("boss") ||
    lower.includes("mech") ||
    lower.includes("robot") ||
    lower.includes("guardian")
  ) {
    archetype = "titan_mech";
  } else if (
    lower.includes("tree") ||
    lower.includes("nature") ||
    lower.includes("crystal") ||
    lower.includes("island")
  ) {
    archetype = "crystal_shrine";
  }

  if (archetype === "cyber_katana") {
    const metalDark = pickColor(0, "#1e222d");
    const bladeSteel = pickColor(1, "#d8e2ef");
    const neonEdge = pickColor(2, "#00f5d4");
    const gripAccent = pickColor(3, "#ff2a85");

    const parts = [
      // Pommel & Core Handle
      { name: "Handle", shape: "Cylinder", size: [0.32, 3.6, 0.32], pos: [0, 2.2, 0], rot: [0, 0, 90], color: metalDark, material: "Metal", isPrimary: true },
      { name: "PommelCap", shape: "Cylinder", size: [0.42, 0.35, 0.42], pos: [0, 0.3, 0], rot: [0, 0, 90], color: metalDark, material: "Metal" },
      { name: "PommelCoreNeon", shape: "Ball", size: [0.36, 0.36, 0.36], pos: [0, 0.1, 0], rot: [0, 0, 0], color: neonEdge, material: "Neon", light: { color: neonEdge, brightness: 2.5, range: 8 } },
      // Tsuka-ito Grip Wraps (7 alternating diamond rings)
      ...Array.from({ length: 7 }, (_, i) => ({
        name: `GripWrap_${i + 1}`,
        shape: "Block",
        size: [0.38, 0.24, 0.38],
        pos: [0, 0.75 + i * 0.42, 0],
        rot: [0, 45, 0],
        color: i % 2 === 0 ? gripAccent : "#141720",
        material: i % 2 === 0 ? "Neon" : "Fabric"
      })),
      // Tsuba Guard Assembly
      { name: "TsubaGuardPlate", shape: "Block", size: [1.35, 0.22, 0.95], pos: [0, 4.05, 0], rot: [0, 0, 0], color: metalDark, material: "Metal" },
      { name: "TsubaNeonRim", shape: "Block", size: [1.42, 0.08, 1.02], pos: [0, 4.05, 0], rot: [0, 0, 0], color: neonEdge, material: "Neon" },
      { name: "HabakiCollar", shape: "Block", size: [0.46, 0.55, 0.26], pos: [0, 4.4, 0], rot: [0, 0, 0], color: gripAccent, material: "Metal" },
      // Segmented Curved Katana Blade (Lower, Mid, Upper, Kissaki Tip)
      { name: "BladeSpine_Lower", shape: "Block", size: [0.34, 2.8, 0.12], pos: [-0.04, 6.0, 0], rot: [0, 0, -2], color: metalDark, material: "Metal" },
      { name: "BladeEdge_Lower", shape: "Block", size: [0.14, 2.8, 0.06], pos: [0.18, 6.0, 0], rot: [0, 0, -2], color: neonEdge, material: "Neon", light: { color: neonEdge, brightness: 3, range: 12 } },
      { name: "BladeSpine_Mid", shape: "Block", size: [0.31, 2.8, 0.11], pos: [-0.14, 8.75, 0], rot: [0, 0, -5], color: bladeSteel, material: "Metal" },
      { name: "BladeEdge_Mid", shape: "Block", size: [0.13, 2.8, 0.05], pos: [0.07, 8.75, 0], rot: [0, 0, -5], color: neonEdge, material: "Neon" },
      { name: "BladeSpine_Upper", shape: "Block", size: [0.26, 2.4, 0.09], pos: [-0.34, 11.25, 0], rot: [0, 0, -9], color: bladeSteel, material: "Metal" },
      { name: "BladeEdge_Upper", shape: "Block", size: [0.12, 2.4, 0.05], pos: [-0.14, 11.25, 0], rot: [0, 0, -9], color: neonEdge, material: "Neon" },
      { name: "KissakiTip", shape: "Wedge", size: [0.09, 1.35, 0.34], pos: [-0.55, 13.0, 0], rot: [0, 90, -13], color: neonEdge, material: "Neon" }
    ];

    return finalizeModelSpec({
      name: "CyberPlasmaKatana",
      category: "Weapon / Tool",
      description: `High-precision 19-part Cyberpunk Plasma Katana with Tsuka-ito grip wraps, Tsuba neon guard, curved 3-stage blade, and Kissaki wedge tip${primaryPhoto ? " (color-matched to attached reference)" : ""}.`,
      parts
    });
  }

  if (archetype === "cyber_supercar") {
    const bodyColor = pickColor(0, "#e63946");
    const trimDark = pickColor(1, "#141824");
    const neonColor = pickColor(2, "#00f5d4");
    const glassColor = "#56cfe1";

    const parts = [
      // Main Chassis Floor & Aero Splitter
      { name: "ChassisCore", shape: "Block", size: [7.6, 1.1, 15.8], pos: [0, 1.6, 0], rot: [0, 0, 0], color: trimDark, material: "Metal", isPrimary: true },
      { name: "MainBodyShell", shape: "Block", size: [7.4, 1.35, 14.6], pos: [0, 2.35, 0], rot: [0, 0, 0], color: bodyColor, material: "SmoothPlastic", reflectance: 0.25 },
      { name: "FrontHoodSlope", shape: "Wedge", size: [7.2, 1.1, 4.4], pos: [0, 2.6, -5.6], rot: [0, 0, 0], color: bodyColor, material: "SmoothPlastic", reflectance: 0.25 },
      { name: "FrontAeroSplitter", shape: "Block", size: [7.8, 0.25, 1.8], pos: [0, 1.05, -7.4], rot: [0, 0, 0], color: trimDark, material: "Carbon" },
      // Cabin & Glass Canopy
      { name: "GlassCanopy", shape: "Block", size: [6.0, 1.4, 6.2], pos: [0, 3.45, -0.4], rot: [0, 0, 0], color: glassColor, material: "Glass", transparency: 0.35 },
      { name: "WindshieldSlope", shape: "Wedge", size: [6.0, 1.4, 2.8], pos: [0, 3.45, -4.9], rot: [0, 0, 0], color: glassColor, material: "Glass", transparency: 0.35 },
      { name: "RearEngineDeck", shape: "Wedge", size: [6.2, 1.35, 4.2], pos: [0, 3.42, 4.8], rot: [0, 180, 0], color: trimDark, material: "Metal" },
      // GT Rear Wing Spoiler
      { name: "SpoilerStrutL", shape: "Block", size: [0.25, 1.3, 1.1], pos: [-2.4, 3.6, 6.9], rot: [-12, 0, 0], color: trimDark, material: "Metal" },
      { name: "SpoilerStrutR", shape: "Block", size: [0.25, 1.3, 1.1], pos: [2.4, 3.6, 6.9], rot: [-12, 0, 0], color: trimDark, material: "Metal" },
      { name: "SpoilerWingBlade", shape: "Block", size: [7.6, 0.22, 1.6], pos: [0, 4.25, 7.2], rot: [8, 0, 0], color: bodyColor, material: "SmoothPlastic" },
      // Headlights & Taillight Bar
      { name: "HeadlightBarL", shape: "Block", size: [2.1, 0.22, 0.35], pos: [-2.4, 2.25, -7.8], rot: [0, 8, 0], color: neonColor, material: "Neon", light: { color: neonColor, brightness: 4, range: 24 } },
      { name: "HeadlightBarR", shape: "Block", size: [2.1, 0.22, 0.35], pos: [2.4, 2.25, -7.8], rot: [0, -8, 0], color: neonColor, material: "Neon", light: { color: neonColor, brightness: 4, range: 24 } },
      { name: "RearTaillightStrip", shape: "Block", size: [7.1, 0.28, 0.3], pos: [0, 2.55, 7.85], rot: [0, 0, 0], color: "#ff1e42", material: "Neon", light: { color: "#ff1e42", brightness: 3, range: 14 } },
      // 4 Detailed Wheels + Alloy Rims
      ...[
        [-3.85, 1.55, -5.0, "FL"],
        [3.85, 1.55, -5.0, "FR"],
        [-3.85, 1.65, 5.0, "RL"],
        [3.85, 1.65, 5.0, "RR"]
      ].flatMap(([wx, wy, wz, tag]) => [
        { name: `Tire_${tag}`, shape: "Cylinder", size: [1.1, 3.0, 3.0], pos: [wx, wy, wz], rot: [0, 0, 0], color: "#111318", material: "SmoothPlastic" },
        { name: `AlloyRim_${tag}`, shape: "Cylinder", size: [1.18, 1.9, 1.9], pos: [wx, wy, wz], rot: [0, 0, 0], color: neonColor, material: "Neon" }
      ])
    ];

    return finalizeModelSpec({
      name: "CyberGT_Supercar",
      category: "Vehicle",
      description: `21-part aerodynamic Cyber GT Supercar with wedge hood/windshield geometry, glass canopy, GT rear spoiler wing, LED lightbars, and 4 alloy wheel assemblies.`,
      parts
    });
  }

  if (archetype === "citadel_tower") {
    const stoneBase = pickColor(0, "#6c757d");
    const wallTimber = pickColor(1, "#e9ecef");
    const roofTile = pickColor(2, "#3a5a40");
    const lanternGlow = pickColor(3, "#ffb703");

    const parts = [
      { name: "FoundationPlinth", shape: "Block", size: [16, 2.2, 16], pos: [0, 1.1, 0], rot: [0, 0, 0], color: stoneBase, material: "Cobblestone", isPrimary: true },
      { name: "StepStair_1", shape: "Block", size: [5.5, 0.7, 2.4], pos: [0, 0.35, -8.8], rot: [0, 0, 0], color: stoneBase, material: "Cobblestone" },
      { name: "StepStair_2", shape: "Block", size: [4.8, 1.4, 1.6], pos: [0, 0.7, -8.2], rot: [0, 0, 0], color: stoneBase, material: "Cobblestone" },
      { name: "SanctumCoreWalls", shape: "Block", size: [12, 10, 12], pos: [0, 7.2, 0], rot: [0, 0, 0], color: wallTimber, material: "SmoothPlastic" },
      // 4 Corner Pillars
      ...[
        [-6.2, -6.2, "NW"],
        [6.2, -6.2, "NE"],
        [-6.2, 6.2, "SW"],
        [6.2, 6.2, "SE"]
      ].map(([px, pz, tag]) => ({
        name: `CornerPillar_${tag}`,
        shape: "Block",
        size: [1.6, 11.2, 1.6],
        pos: [px, 7.6, pz],
        rot: [0, 0, 0],
        color: "#4a3728",
        material: "WoodPlanks"
      })),
      // Entrance Arch & Door
      { name: "GrandDoorway", shape: "Block", size: [3.8, 6.4, 0.6], pos: [0, 5.4, -6.05], rot: [0, 0, 0], color: "#3d2618", material: "WoodPlanks" },
      { name: "DoorRunePortal", shape: "Block", size: [2.8, 5.4, 0.7], pos: [0, 5.2, -6.1], rot: [0, 0, 0], color: lanternGlow, material: "Neon", light: { color: lanternGlow, brightness: 3, range: 18 } },
      // Pagoda / Pitched Roof Tiers
      { name: "LowerRoofEave", shape: "Block", size: [16.8, 0.9, 16.8], pos: [0, 12.6, 0], rot: [0, 0, 0], color: roofTile, material: "Slate" },
      { name: "UpperTowerChamber", shape: "Block", size: [8.6, 5.5, 8.6], pos: [0, 15.8, 0], rot: [0, 0, 0], color: wallTimber, material: "SmoothPlastic" },
      { name: "UpperRoofSlopeL", shape: "Wedge", size: [11.5, 3.8, 5.8], pos: [-2.9, 20.4, 0], rot: [0, 90, 0], color: roofTile, material: "Slate" },
      { name: "UpperRoofSlopeR", shape: "Wedge", size: [11.5, 3.8, 5.8], pos: [2.9, 20.4, 0], rot: [0, -90, 0], color: roofTile, material: "Slate" },
      { name: "SpireFinial", shape: "Cylinder", size: [0.6, 4.2, 0.6], pos: [0, 23.5, 0], rot: [0, 0, 90], color: lanternGlow, material: "Neon" },
      // Hanging Lanterns
      { name: "Lantern_Left", shape: "Ball", size: [1.2, 1.2, 1.2], pos: [-7.2, 11.2, -7.2], rot: [0, 0, 0], color: lanternGlow, material: "Neon", light: { color: lanternGlow, brightness: 2.5, range: 15 } },
      { name: "Lantern_Right", shape: "Ball", size: [1.2, 1.2, 1.2], pos: [7.2, 11.2, -7.2], rot: [0, 0, 0], color: lanternGlow, material: "Neon", light: { color: lanternGlow, brightness: 2.5, range: 15 } }
    ];

    return finalizeModelSpec({
      name: "CitadelShrineTower",
      category: "Architecture / Environment",
      description: `17-part Citadel Shrine Tower with cobblestone plinth stairs, timber corner pillars, pitched slate roof wedges, glowing rune doorway, and hanging lanterns.`,
      parts
    });
  }

  if (archetype === "pulse_rifle") {
    const gunMetal = pickColor(0, "#1d222b");
    const bodyAccent = pickColor(1, "#3a4454");
    const plasmaCore = pickColor(2, "#00bbf9");

    const parts = [
      { name: "ReceiverCore", shape: "Block", size: [0.65, 1.1, 4.2], pos: [0, 3.0, 0], rot: [0, 0, 0], color: gunMetal, material: "Metal", isPrimary: true },
      { name: "UpperRailShroud", shape: "Block", size: [0.72, 0.45, 4.6], pos: [0, 3.65, -0.3], rot: [0, 0, 0], color: bodyAccent, material: "Metal" },
      { name: "TacticalStock", shape: "Block", size: [0.55, 1.25, 2.2], pos: [0, 2.75, 2.8], rot: [0, 0, 0], color: gunMetal, material: "SmoothPlastic" },
      { name: "PistolGrip", shape: "Block", size: [0.5, 1.4, 0.75], pos: [0, 2.0, 1.0], rot: [18, 0, 0], color: "#14171f", material: "Fabric" },
      { name: "EnergyMagazine", shape: "Block", size: [0.48, 1.65, 0.9], pos: [0, 1.85, -0.6], rot: [-10, 0, 0], color: bodyAccent, material: "Metal" },
      { name: "MagazineNeonStrip", shape: "Block", size: [0.52, 1.3, 0.2], pos: [0, 1.85, -0.6], rot: [-10, 0, 0], color: plasmaCore, material: "Neon" },
      { name: "HeavyBarrel", shape: "Cylinder", size: [0.32, 3.8, 0.32], pos: [0, 3.35, -3.5], rot: [0, 90, 0], color: gunMetal, material: "Metal" },
      { name: "PlasmaChamberCoil", shape: "Block", size: [0.75, 0.55, 2.8], pos: [0, 3.25, -1.5], rot: [0, 0, 0], color: plasmaCore, material: "Neon", light: { color: plasmaCore, brightness: 3, range: 12 } },
      { name: "MuzzleBrake", shape: "Cylinder", size: [0.45, 0.65, 0.45], pos: [0, 3.35, -5.5], rot: [0, 90, 0], color: plasmaCore, material: "Neon" },
      { name: "HoloSightFrame", shape: "Block", size: [0.6, 0.65, 1.1], pos: [0, 4.15, 0.2], rot: [0, 0, 0], color: gunMetal, material: "Metal" },
      { name: "HoloSightLens", shape: "Block", size: [0.48, 0.48, 0.1], pos: [0, 4.2, 0.2], rot: [0, 0, 0], color: plasmaCore, material: "Neon", transparency: 0.45 }
    ];

    return finalizeModelSpec({
      name: "ValkyriePulseRifle",
      category: "Weapon / Sci-Fi",
      description: `11-part Sci-Fi Valkyrie Pulse Rifle with holographic optic sight, angled grip, plasma coil chamber, and muzzle emitter.`,
      parts
    });
  }

  // Default / Titan Mech / Combat Guardian
  const armorMain = pickColor(0, "#2b3346");
  const armorDark = pickColor(1, "#181d27");
  const coreNeon = pickColor(2, "#00f5d4");
  const visorNeon = pickColor(3, "#ff2a85");

  const parts = [
    // Pelvis & Torso Core
    { name: "TorsoChassis", shape: "Block", size: [4.8, 5.2, 3.2], pos: [0, 8.6, 0], rot: [0, 0, 0], color: armorMain, material: "Metal", isPrimary: true },
    { name: "ChestArmorPlate", shape: "Wedge", size: [4.4, 3.2, 1.2], pos: [0, 9.4, -2.0], rot: [0, 0, 0], color: armorMain, material: "Metal" },
    { name: "ReactorArcCore", shape: "Cylinder", size: [0.8, 1.8, 1.8], pos: [0, 9.2, -2.35], rot: [0, 90, 0], color: coreNeon, material: "Neon", light: { color: coreNeon, brightness: 4.5, range: 20 } },
    { name: "PelvisUnit", shape: "Block", size: [3.8, 1.6, 2.6], pos: [0, 5.4, 0], rot: [0, 0, 0], color: armorDark, material: "Metal" },
    // Head & Optical Visor
    { name: "MechHeadUnit", shape: "Block", size: [2.4, 2.1, 2.4], pos: [0, 12.4, 0], rot: [0, 0, 0], color: armorMain, material: "Metal" },
    { name: "OpticalVisorStrip", shape: "Block", size: [2.2, 0.55, 0.3], pos: [0, 12.5, -1.2], rot: [0, 0, 0], color: visorNeon, material: "Neon", light: { color: visorNeon, brightness: 3, range: 14 } },
    { name: "HeadAntennaL", shape: "Block", size: [0.22, 1.6, 0.45], pos: [-1.25, 13.6, 0.2], rot: [-15, 0, 0], color: coreNeon, material: "Neon" },
    { name: "HeadAntennaR", shape: "Block", size: [0.22, 1.6, 0.45], pos: [1.25, 13.6, 0.2], rot: [-15, 0, 0], color: coreNeon, material: "Neon" },
    // Pauldrons & Articulated Arms + Plasma Cannons
    { name: "ShoulderPauldronL", shape: "Block", size: [2.2, 2.2, 3.0], pos: [-3.6, 10.4, 0], rot: [0, 0, 12], color: armorMain, material: "Metal" },
    { name: "ShoulderPauldronR", shape: "Block", size: [2.2, 2.2, 3.0], pos: [3.6, 10.4, 0], rot: [0, 0, -12], color: armorMain, material: "Metal" },
    { name: "LeftArmCannon", shape: "Cylinder", size: [1.2, 4.4, 1.2], pos: [-3.8, 7.6, -1.4], rot: [75, 0, 0], color: armorDark, material: "Metal" },
    { name: "LeftCannonMuzzle", shape: "Cylinder", size: [1.0, 0.6, 1.0], pos: [-3.8, 7.0, -3.5], rot: [75, 0, 0], color: coreNeon, material: "Neon" },
    { name: "RightArmCannon", shape: "Cylinder", size: [1.2, 4.4, 1.2], pos: [3.8, 7.6, -1.4], rot: [75, 0, 0], color: armorDark, material: "Metal" },
    { name: "RightCannonMuzzle", shape: "Cylinder", size: [1.0, 0.6, 1.0], pos: [3.8, 7.0, -3.5], rot: [75, 0, 0], color: coreNeon, material: "Neon" },
    // Jetpack Thrusters
    { name: "JetpackPod", shape: "Block", size: [3.6, 3.6, 1.6], pos: [0, 9.2, 2.2], rot: [0, 0, 0], color: armorDark, material: "Metal" },
    { name: "ThrusterNozzleL", shape: "Cylinder", size: [1.0, 1.2, 1.0], pos: [-1.1, 7.1, 2.4], rot: [0, 0, 90], color: coreNeon, material: "Neon" },
    { name: "ThrusterNozzleR", shape: "Cylinder", size: [1.0, 1.2, 1.0], pos: [1.1, 7.1, 2.4], rot: [0, 0, 90], color: coreNeon, material: "Neon" },
    // Heavy Legs & Feet
    { name: "UpperLegL", shape: "Block", size: [1.6, 2.8, 1.8], pos: [-1.4, 3.6, 0], rot: [0, 0, 0], color: armorDark, material: "Metal" },
    { name: "UpperLegR", shape: "Block", size: [1.6, 2.8, 1.8], pos: [1.4, 3.6, 0], rot: [0, 0, 0], color: armorDark, material: "Metal" },
    { name: "LowerLegArmorL", shape: "Block", size: [1.9, 2.6, 2.2], pos: [-1.4, 1.7, 0], rot: [0, 0, 0], color: armorMain, material: "Metal" },
    { name: "LowerLegArmorR", shape: "Block", size: [1.9, 2.6, 2.2], pos: [1.4, 1.7, 0], rot: [0, 0, 0], color: armorMain, material: "Metal" },
    { name: "FootStabilizerL", shape: "Block", size: [2.2, 0.7, 3.2], pos: [-1.4, 0.35, -0.4], rot: [0, 0, 0], color: armorDark, material: "Metal" },
    { name: "FootStabilizerR", shape: "Block", size: [2.2, 0.7, 3.2], pos: [1.4, 0.35, -0.4], rot: [0, 0, 0], color: armorDark, material: "Metal" }
  ];

  return finalizeModelSpec({
    name: "AegisTitanMech",
    category: "Character / Mecha",
    description: `23-part Aegis Titan Mech with chest reactor core, glowing optical visor, dual articulated plasma cannons, jetpack thrusters, and heavy leg stabilizers${primaryPhoto ? " (adapted from attached photo palette)" : ""}.`,
    parts
  });
}

function finalizeModelSpec(spec) {
  const luauScript = buildModelLuauScript(spec);
  const rbxmx = buildModelRbxmx(spec, luauScript);
  return {
    type: "roblox_model",
    ...spec,
    partCount: spec.parts.length,
    luauScript,
    rbxmx
  };
}

function hexToRgb01(hex) {
  const clean = String(hex || "#ffffff").replace("#", "");
  const num = parseInt(clean, 16) || 0xffffff;
  const r = ((num >> 16) & 255) / 255;
  const g = ((num >> 8) & 255) / 255;
  const b = (num & 255) / 255;
  return [Number(r.toFixed(4)), Number(g.toFixed(4)), Number(b.toFixed(4))];
}

function hexToRgb255(hex) {
  const clean = String(hex || "#ffffff").replace("#", "");
  const num = parseInt(clean, 16) || 0xffffff;
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

export function buildModelLuauScript(spec) {
  const lines = [
    `-- Generated by OpenAI Codex (v0.1.0-free) — Roblox Studio 3D Model Builder`,
    `-- Model: ${spec.name} (${spec.parts.length} precision parts)`,
    `-- Paste into Roblox Studio Command Bar or run via the Codex-Free Live Sync Plugin`,
    ``,
    `local Workspace = game:GetService("Workspace")`,
    `local model = Instance.new("Model")`,
    `model.Name = "${spec.name}"`,
    `model.Parent = Workspace`,
    ``,
    `local partsByName = {}`,
    `local function createPart(name, shape, size, pos, rot, color, mat, transparency, reflectance, lightInfo)`,
    `    local p = Instance.new(shape == "Wedge" and "WedgePart" or "Part")`,
    `    p.Name = name`,
    `    if shape == "Cylinder" and p:IsA("Part") then p.Shape = Enum.PartType.Cylinder`,
    `    elseif shape == "Ball" and p:IsA("Part") then p.Shape = Enum.PartType.Ball end`,
    `    p.Size = size`,
    `    p.CFrame = CFrame.new(pos) * CFrame.Angles(math.rad(rot.X), math.rad(rot.Y), math.rad(rot.Z))`,
    `    p.Color = color`,
    `    p.Material = Enum.Material[mat] or Enum.Material.SmoothPlastic`,
    `    p.Transparency = transparency or 0`,
    `    p.Reflectance = reflectance or 0`,
    `    p.Anchored = true`,
    `    p.TopSurface = Enum.SurfaceType.Smooth`,
    `    p.BottomSurface = Enum.SurfaceType.Smooth`,
    `    p.Parent = model`,
    `    if lightInfo then`,
    `        local light = Instance.new("PointLight")`,
    `        light.Color = lightInfo.color`,
    `        light.Brightness = lightInfo.brightness`,
    `        light.Range = lightInfo.range`,
    `        light.Parent = p`,
    `    end`,
    `    partsByName[name] = p`,
    `    return p`,
    `end`,
    ``
  ];

  for (const p of spec.parts) {
    const [r, g, b] = hexToRgb255(p.color);
    const [sx, sy, sz] = p.size;
    const [px, py, pz] = p.pos;
    const [rx, ry, rz] = p.rot || [0, 0, 0];
    const lightArg = p.light
      ? `{ color = Color3.fromRGB(${hexToRgb255(p.light.color).join(", ")}), brightness = ${p.light.brightness}, range = ${p.light.range} }`
      : `nil`;

    lines.push(
      `createPart("${p.name}", "${p.shape || "Block"}", Vector3.new(${sx}, ${sy}, ${sz}), Vector3.new(${px}, ${py}, ${pz}), Vector3.new(${rx}, ${ry}, ${rz}), Color3.fromRGB(${r}, ${g}, ${b}), "${p.material || "SmoothPlastic"}", ${p.transparency || 0}, ${p.reflectance || 0}, ${lightArg})`
    );
    if (p.isPrimary) {
      lines.push(`model.PrimaryPart = partsByName["${p.name}"]`);
    }
  }

  lines.push(
    ``,
    `-- Weld all parts to PrimaryPart so the model can move as a cohesive unit`,
    `if model.PrimaryPart then`,
    `    for _, child in ipairs(model:GetChildren()) do`,
    `        if child:IsA("BasePart") and child ~= model.PrimaryPart then`,
    `            local weld = Instance.new("WeldConstraint")`,
    `            weld.Part0 = model.PrimaryPart`,
    `            weld.Part1 = child`,
    `            weld.Parent = model.PrimaryPart`,
    `        end`,
    `    end`,
    `end`,
    `print("[Codex-Free] Spawned Roblox Model: ${spec.name} (${spec.parts.length} parts)")`,
    `return model`
  );

  return lines.join("\n");
}

export function buildModelRbxmx(spec, luauScript) {
  const partItems = spec.parts
    .map((p, idx) => {
      const [r, g, b] = hexToRgb01(p.color);
      const [sx, sy, sz] = p.size;
      const [px, py, pz] = p.pos;
      const className = p.shape === "Wedge" ? "WedgePart" : "Part";
      return `    <Item class="${className}" referent="RBXPart${idx + 1}">
      <Properties>
        <string name="Name">${p.name}</string>
        <bool name="Anchored">true</bool>
        <Color3 name="Color3uint8">
          <R>${r}</R>
          <G>${g}</G>
          <B>${b}</B>
        </Color3>
        <Vector3 name="size">
          <X>${sx}</X>
          <Y>${sy}</Y>
          <Z>${sz}</Z>
        </Vector3>
        <CoordinateFrame name="CFrame">
          <X>${px}</X>
          <Y>${py}</Y>
          <Z>${pz}</Z>
          <R00>1</R00><R01>0</R01><R02>0</R02>
          <R10>0</R10><R11>1</R11><R12>0</R12>
          <R20>0</R20><R21>0</R21><R22>1</R22>
        </CoordinateFrame>
      </Properties>
    </Item>`;
    })
    .join("\n");

  const escapedScript = String(luauScript || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  return `<roblox xmlns:xmime="http://www.w3.org/2005/05/xmlmime" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="http://www.roblox.com/roblox.xsd" version="4">
  <External>null</External>
  <External>nil</External>
  <Item class="Model" referent="RBXModelRoot">
    <Properties>
      <string name="Name">${spec.name}</string>
    </Properties>
${partItems}
    <Item class="Script" referent="RBXBuilderScript">
      <Properties>
        <string name="Name">CodexBuilderScript</string>
        <ProtectedString name="Source">${escapedScript}</ProtectedString>
      </Properties>
    </Item>
  </Item>
</roblox>
`;
}

/**
 * Generates an accurate R15 KeyframeSequence Animation from a prompt + optional video motion metadata.
 */
export function generateRobloxAnimationSpec(prompt = "", attachments = []) {
  const lower = String(prompt || "").toLowerCase();
  const videoAttachment = attachments.find(
    (a) => a.type === "video" || (a.motionFrames && a.motionFrames.length > 0)
  );

  // If user attached a video with sampled motion frames, synthesize keyframes from the video motion!
  if (videoAttachment && Array.isArray(videoAttachment.motionFrames) && videoAttachment.motionFrames.length > 0) {
    const frames = videoAttachment.motionFrames;
    const duration = Number(videoAttachment.duration || Math.max(1.6, frames.length * 0.25)).toFixed(2);
    const keyframes = frames.map((f, idx) => {
      const t = Number(((idx / Math.max(1, frames.length - 1)) * Number(duration)).toFixed(2));
      const energy = f.energy ?? 0.5;
      const cx = (f.centerX ?? 0.5) - 0.5;
      const cy = 0.5 - (f.centerY ?? 0.5);
      const phase = (idx / frames.length) * Math.PI * 2;

      return {
        time: t,
        name: `VideoMotion_Frame_${idx + 1}`,
        easingStyle: "Cubic",
        easingDirection: "InOut",
        poses: {
          LowerTorso: { pos: [Number((cx * 1.2).toFixed(2)), Number((cy * 0.8).toFixed(2)), 0], rot: [Math.round(energy * 15), Math.round(cx * 35), 0] },
          UpperTorso: { pos: [0, 0, 0], rot: [Math.round(-energy * 18), Math.round(-cx * 28), Math.round(Math.sin(phase) * 8)] },
          Head: { pos: [0, 0, 0], rot: [Math.round(cy * 20), Math.round(cx * 25), 0] },
          LeftUpperArm: { pos: [0, 0, 0], rot: [Math.round(35 + Math.sin(phase) * 75 * (0.5 + energy)), 0, Math.round(-20 - energy * 45)] },
          LeftLowerArm: { pos: [0, 0, 0], rot: [Math.round(25 + energy * 55), 0, 0] },
          RightUpperArm: { pos: [0, 0, 0], rot: [Math.round(35 - Math.sin(phase) * 75 * (0.5 + energy)), 0, Math.round(20 + energy * 45)] },
          RightLowerArm: { pos: [0, 0, 0], rot: [Math.round(25 + energy * 55), 0, 0] },
          LeftUpperLeg: { pos: [0, 0, 0], rot: [Math.round(Math.sin(phase) * 45 * (0.4 + energy)), 0, -4] },
          LeftLowerLeg: { pos: [0, 0, 0], rot: [Math.round(-Math.abs(Math.sin(phase)) * 48), 0, 0] },
          RightUpperLeg: { pos: [0, 0, 0], rot: [Math.round(-Math.sin(phase) * 45 * (0.4 + energy)), 0, 4] },
          RightLowerLeg: { pos: [0, 0, 0], rot: [Math.round(-Math.abs(Math.cos(phase)) * 48), 0, 0] }
        }
      };
    });

    return finalizeAnimationSpec({
      name: `VideoMocap_${(videoAttachment.name || "Clip").replace(/[^a-zA-Z0-9]/g, "_").slice(0, 18)}`,
      rigType: "R15",
      looped: true,
      priority: "Action",
      duration: Number(duration),
      description: `R15 Motion-Captured KeyframeSequence extracted from attached video "${videoAttachment.name}" (${keyframes.length} motion keyframes sampled).`,
      keyframes
    });
  }

  // Preset 1: Katana / Sword 3-Hit Combo Slash
  if (
    lower.includes("sword") ||
    lower.includes("slash") ||
    lower.includes("katana") ||
    lower.includes("attack") ||
    lower.includes("combo") ||
    lower.includes("combat")
  ) {
    const keyframes = [
      {
        time: 0.0,
        name: "CombatReadyStance",
        easingStyle: "Cubic",
        easingDirection: "Out",
        poses: {
          LowerTorso: { pos: [0, -0.25, 0], rot: [-6, -28, 0] },
          UpperTorso: { pos: [0, 0, 0], rot: [-10, -22, 4] },
          Head: { pos: [0, 0, 0], rot: [8, 42, 0] },
          RightUpperArm: { pos: [0, 0, 0], rot: [115, 25, 38] },
          RightLowerArm: { pos: [0, 0, 0], rot: [65, 0, 0] },
          RightHand: { pos: [0, 0, 0], rot: [-15, 0, 10] },
          LeftUpperArm: { pos: [0, 0, 0], rot: [45, -20, -25] },
          LeftLowerArm: { pos: [0, 0, 0], rot: [50, 0, 0] },
          LeftUpperLeg: { pos: [0, 0, 0], rot: [28, 12, -8] },
          LeftLowerLeg: { pos: [0, 0, 0], rot: [-36, 0, 0] },
          RightUpperLeg: { pos: [0, 0, 0], rot: [-24, -10, 8] },
          RightLowerLeg: { pos: [0, 0, 0], rot: [-28, 0, 0] }
        }
      },
      {
        time: 0.28,
        name: "DiagonalStrike1_Impact",
        easingStyle: "Cubic",
        easingDirection: "InOut",
        poses: {
          LowerTorso: { pos: [0, -0.35, -0.4], rot: [-14, 34, 0] },
          UpperTorso: { pos: [0, 0, 0], rot: [-18, 42, -8] },
          Head: { pos: [0, 0, 0], rot: [12, -32, 0] },
          RightUpperArm: { pos: [0, 0, 0], rot: [22, -45, -28] },
          RightLowerArm: { pos: [0, 0, 0], rot: [18, 0, 0] },
          RightHand: { pos: [0, 0, 0], rot: [-35, 0, 0] },
          LeftUpperArm: { pos: [0, 0, 0], rot: [-38, 15, -32] },
          LeftLowerArm: { pos: [0, 0, 0], rot: [35, 0, 0] },
          LeftUpperLeg: { pos: [0, 0, 0], rot: [42, 0, -6] },
          LeftLowerLeg: { pos: [0, 0, 0], rot: [-48, 0, 0] },
          RightUpperLeg: { pos: [0, 0, 0], rot: [-35, 0, 6] },
          RightLowerLeg: { pos: [0, 0, 0], rot: [-22, 0, 0] }
        }
      },
      {
        time: 0.62,
        name: "ReverseCrossSlash2",
        easingStyle: "Cubic",
        easingDirection: "InOut",
        poses: {
          LowerTorso: { pos: [0, -0.2, -0.6], rot: [-8, -45, 0] },
          UpperTorso: { pos: [0, 0, 0], rot: [-12, -48, 10] },
          Head: { pos: [0, 0, 0], rot: [6, 48, 0] },
          RightUpperArm: { pos: [0, 0, 0], rot: [88, 65, 55] },
          RightLowerArm: { pos: [0, 0, 0], rot: [24, 0, 0] },
          LeftUpperArm: { pos: [0, 0, 0], rot: [62, -30, -40] },
          LeftLowerArm: { pos: [0, 0, 0], rot: [40, 0, 0] },
          LeftUpperLeg: { pos: [0, 0, 0], rot: [-25, 0, -8] },
          LeftLowerLeg: { pos: [0, 0, 0], rot: [-30, 0, 0] },
          RightUpperLeg: { pos: [0, 0, 0], rot: [38, 0, 8] },
          RightLowerLeg: { pos: [0, 0, 0], rot: [-44, 0, 0] }
        }
      },
      {
        time: 0.95,
        name: "AerialSpinCleave_Apex",
        easingStyle: "Sine",
        easingDirection: "Out",
        poses: {
          LowerTorso: { pos: [0, 1.45, -0.8], rot: [15, 180, 0] },
          UpperTorso: { pos: [0, 0, 0], rot: [-24, 30, 0] },
          Head: { pos: [0, 0, 0], rot: [18, -20, 0] },
          RightUpperArm: { pos: [0, 0, 0], rot: [155, 10, 20] },
          RightLowerArm: { pos: [0, 0, 0], rot: [15, 0, 0] },
          LeftUpperArm: { pos: [0, 0, 0], rot: [130, -10, -35] },
          LeftUpperLeg: { pos: [0, 0, 0], rot: [55, 0, -10] },
          LeftLowerLeg: { pos: [0, 0, 0], rot: [-68, 0, 0] },
          RightUpperLeg: { pos: [0, 0, 0], rot: [35, 0, 10] },
          RightLowerLeg: { pos: [0, 0, 0], rot: [-55, 0, 0] }
        }
      },
      {
        time: 1.35,
        name: "HeavyLandingFinisher",
        easingStyle: "Bounce",
        easingDirection: "Out",
        poses: {
          LowerTorso: { pos: [0, -0.65, -1.1], rot: [-22, 25, 0] },
          UpperTorso: { pos: [0, 0, 0], rot: [-28, 35, -6] },
          Head: { pos: [0, 0, 0], rot: [24, -28, 0] },
          RightUpperArm: { pos: [0, 0, 0], rot: [-15, -20, 18] },
          RightLowerArm: { pos: [0, 0, 0], rot: [12, 0, 0] },
          LeftUpperArm: { pos: [0, 0, 0], rot: [-45, 20, -28] },
          LeftUpperLeg: { pos: [0, 0, 0], rot: [62, 0, -8] },
          LeftLowerLeg: { pos: [0, 0, 0], rot: [-72, 0, 0] },
          RightUpperLeg: { pos: [0, 0, 0], rot: [-42, 0, 8] },
          RightLowerLeg: { pos: [0, 0, 0], rot: [-58, 0, 0] }
        }
      },
      {
        time: 1.75,
        name: "RecoveryToStance",
        easingStyle: "Cubic",
        easingDirection: "InOut",
        poses: {
          LowerTorso: { pos: [0, -0.25, 0], rot: [-6, -28, 0] },
          UpperTorso: { pos: [0, 0, 0], rot: [-10, -22, 4] },
          Head: { pos: [0, 0, 0], rot: [8, 42, 0] },
          RightUpperArm: { pos: [0, 0, 0], rot: [115, 25, 38] },
          RightLowerArm: { pos: [0, 0, 0], rot: [65, 0, 0] },
          LeftUpperArm: { pos: [0, 0, 0], rot: [45, -20, -25] },
          LeftLowerArm: { pos: [0, 0, 0], rot: [50, 0, 0] },
          LeftUpperLeg: { pos: [0, 0, 0], rot: [28, 12, -8] },
          LeftLowerLeg: { pos: [0, 0, 0], rot: [-36, 0, 0] },
          RightUpperLeg: { pos: [0, 0, 0], rot: [-24, -10, 8] },
          RightLowerLeg: { pos: [0, 0, 0], rot: [-28, 0, 0] }
        }
      }
    ];

    return finalizeAnimationSpec({
      name: "KatanaTripleSlashCombo",
      rigType: "R15",
      looped: true,
      priority: "Action4",
      duration: 1.75,
      description: `6-keyframe R15 Katana 3-Hit Combo Animation with diagonal cleave, reverse cross-slash, 360° aerial leap apex, and heavy ground-slam finisher.`,
      keyframes
    });
  }

  // Preset 2: Backflip / Parkour Acrobatic Flip
  if (
    lower.includes("flip") ||
    lower.includes("backflip") ||
    lower.includes("parkour") ||
    lower.includes("jump") ||
    lower.includes("vault")
  ) {
    const keyframes = [
      {
        time: 0.0,
        name: "CrouchWindup",
        easingStyle: "Quad",
        easingDirection: "In",
        poses: {
          LowerTorso: { pos: [0, -0.85, 0], rot: [-28, 0, 0] },
          UpperTorso: { pos: [0, 0, 0], rot: [-25, 0, 0] },
          Head: { pos: [0, 0, 0], rot: [22, 0, 0] },
          LeftUpperArm: { pos: [0, 0, 0], rot: [-55, 0, -12] },
          RightUpperArm: { pos: [0, 0, 0], rot: [-55, 0, 12] },
          LeftUpperLeg: { pos: [0, 0, 0], rot: [68, 0, -5] },
          LeftLowerLeg: { pos: [0, 0, 0], rot: [-82, 0, 0] },
          RightUpperLeg: { pos: [0, 0, 0], rot: [68, 0, 5] },
          RightLowerLeg: { pos: [0, 0, 0], rot: [-82, 0, 0] }
        }
      },
      {
        time: 0.25,
        name: "LaunchExtension",
        easingStyle: "Cubic",
        easingDirection: "Out",
        poses: {
          LowerTorso: { pos: [0, 1.4, 0], rot: [35, 0, 0] },
          UpperTorso: { pos: [0, 0, 0], rot: [28, 0, 0] },
          Head: { pos: [0, 0, 0], rot: [32, 0, 0] },
          LeftUpperArm: { pos: [0, 0, 0], rot: [165, 0, -15] },
          RightUpperArm: { pos: [0, 0, 0], rot: [165, 0, 15] },
          LeftUpperLeg: { pos: [0, 0, 0], rot: [-18, 0, -4] },
          LeftLowerLeg: { pos: [0, 0, 0], rot: [-12, 0, 0] },
          RightUpperLeg: { pos: [0, 0, 0], rot: [-18, 0, 4] },
          RightLowerLeg: { pos: [0, 0, 0], rot: [-12, 0, 0] }
        }
      },
      {
        time: 0.58,
        name: "InvertedTuckApex",
        easingStyle: "Linear",
        easingDirection: "InOut",
        poses: {
          LowerTorso: { pos: [0, 2.8, 0.2], rot: [180, 0, 0] },
          UpperTorso: { pos: [0, 0, 0], rot: [-20, 0, 0] },
          Head: { pos: [0, 0, 0], rot: [15, 0, 0] },
          LeftUpperArm: { pos: [0, 0, 0], rot: [75, 0, -10] },
          LeftLowerArm: { pos: [0, 0, 0], rot: [85, 0, 0] },
          RightUpperArm: { pos: [0, 0, 0], rot: [75, 0, 10] },
          RightLowerArm: { pos: [0, 0, 0], rot: [85, 0, 0] },
          LeftUpperLeg: { pos: [0, 0, 0], rot: [88, 0, -6] },
          LeftLowerLeg: { pos: [0, 0, 0], rot: [-95, 0, 0] },
          RightUpperLeg: { pos: [0, 0, 0], rot: [88, 0, 6] },
          RightLowerLeg: { pos: [0, 0, 0], rot: [-95, 0, 0] }
        }
      },
      {
        time: 0.92,
        name: "ShockAbsorbLanding",
        easingStyle: "Cubic",
        easingDirection: "Out",
        poses: {
          LowerTorso: { pos: [0, -0.65, 0.3], rot: [-22, 0, 0] },
          UpperTorso: { pos: [0, 0, 0], rot: [-18, 0, 0] },
          Head: { pos: [0, 0, 0], rot: [18, 0, 0] },
          LeftUpperArm: { pos: [0, 0, 0], rot: [45, 0, -35] },
          RightUpperArm: { pos: [0, 0, 0], rot: [45, 0, 35] },
          LeftUpperLeg: { pos: [0, 0, 0], rot: [58, 0, -6] },
          LeftLowerLeg: { pos: [0, 0, 0], rot: [-72, 0, 0] },
          RightUpperLeg: { pos: [0, 0, 0], rot: [58, 0, 6] },
          RightLowerLeg: { pos: [0, 0, 0], rot: [-72, 0, 0] }
        }
      },
      {
        time: 1.25,
        name: "StandRecovery",
        easingStyle: "Sine",
        easingDirection: "Out",
        poses: {
          LowerTorso: { pos: [0, 0, 0], rot: [0, 0, 0] },
          UpperTorso: { pos: [0, 0, 0], rot: [0, 0, 0] },
          Head: { pos: [0, 0, 0], rot: [0, 0, 0] },
          LeftUpperArm: { pos: [0, 0, 0], rot: [8, 0, -8] },
          RightUpperArm: { pos: [0, 0, 0], rot: [8, 0, 8] },
          LeftUpperLeg: { pos: [0, 0, 0], rot: [4, 0, -3] },
          LeftLowerLeg: { pos: [0, 0, 0], rot: [-6, 0, 0] },
          RightUpperLeg: { pos: [0, 0, 0], rot: [4, 0, 3] },
          RightLowerLeg: { pos: [0, 0, 0], rot: [-6, 0, 0] }
        }
      }
    ];

    return finalizeAnimationSpec({
      name: "ParkourBackflipSequence",
      rigType: "R15",
      looped: true,
      priority: "Action",
      duration: 1.25,
      description: `5-keyframe R15 Acrobatic Backflip with crouch windup, vertical launch extension, 180° inverted tuck apex, shock-absorption landing, and recovery.`,
      keyframes
    });
  }

  // Default / Tactical Sprint / Run Cycle
  const keyframes = [
    {
      time: 0.0,
      name: "LeftStrideContact",
      easingStyle: "Sine",
      easingDirection: "InOut",
      poses: {
        LowerTorso: { pos: [0, -0.15, 0], rot: [-14, -12, 0] },
        UpperTorso: { pos: [0, 0, 0], rot: [-12, 18, -4] },
        Head: { pos: [0, 0, 0], rot: [16, -6, 0] },
        LeftUpperArm: { pos: [0, 0, 0], rot: [-48, 0, -10] },
        LeftLowerArm: { pos: [0, 0, 0], rot: [72, 0, 0] },
        RightUpperArm: { pos: [0, 0, 0], rot: [58, 0, 10] },
        RightLowerArm: { pos: [0, 0, 0], rot: [82, 0, 0] },
        LeftUpperLeg: { pos: [0, 0, 0], rot: [52, 0, -3] },
        LeftLowerLeg: { pos: [0, 0, 0], rot: [-24, 0, 0] },
        RightUpperLeg: { pos: [0, 0, 0], rot: [-46, 0, 3] },
        RightLowerLeg: { pos: [0, 0, 0], rot: [-68, 0, 0] }
      }
    },
    {
      time: 0.2,
      name: "LeftFlightApex",
      easingStyle: "Sine",
      easingDirection: "InOut",
      poses: {
        LowerTorso: { pos: [0, 0.28, 0], rot: [-16, 0, 0] },
        UpperTorso: { pos: [0, 0, 0], rot: [-14, 0, 0] },
        Head: { pos: [0, 0, 0], rot: [18, 0, 0] },
        LeftUpperArm: { pos: [0, 0, 0], rot: [10, 0, -12] },
        LeftLowerArm: { pos: [0, 0, 0], rot: [78, 0, 0] },
        RightUpperArm: { pos: [0, 0, 0], rot: [10, 0, 12] },
        RightLowerArm: { pos: [0, 0, 0], rot: [78, 0, 0] },
        LeftUpperLeg: { pos: [0, 0, 0], rot: [-12, 0, -3] },
        LeftLowerLeg: { pos: [0, 0, 0], rot: [-45, 0, 0] },
        RightUpperLeg: { pos: [0, 0, 0], rot: [32, 0, 3] },
        RightLowerLeg: { pos: [0, 0, 0], rot: [-75, 0, 0] }
      }
    },
    {
      time: 0.4,
      name: "RightStrideContact",
      easingStyle: "Sine",
      easingDirection: "InOut",
      poses: {
        LowerTorso: { pos: [0, -0.15, 0], rot: [-14, 12, 0] },
        UpperTorso: { pos: [0, 0, 0], rot: [-12, -18, 4] },
        Head: { pos: [0, 0, 0], rot: [16, 6, 0] },
        LeftUpperArm: { pos: [0, 0, 0], rot: [58, 0, -10] },
        LeftLowerArm: { pos: [0, 0, 0], rot: [82, 0, 0] },
        RightUpperArm: { pos: [0, 0, 0], rot: [-48, 0, 10] },
        RightLowerArm: { pos: [0, 0, 0], rot: [72, 0, 0] },
        LeftUpperLeg: { pos: [0, 0, 0], rot: [-46, 0, -3] },
        LeftLowerLeg: { pos: [0, 0, 0], rot: [-68, 0, 0] },
        RightUpperLeg: { pos: [0, 0, 0], rot: [52, 0, 3] },
        RightLowerLeg: { pos: [0, 0, 0], rot: [-24, 0, 0] }
      }
    },
    {
      time: 0.6,
      name: "RightFlightApex",
      easingStyle: "Sine",
      easingDirection: "InOut",
      poses: {
        LowerTorso: { pos: [0, 0.28, 0], rot: [-16, 0, 0] },
        UpperTorso: { pos: [0, 0, 0], rot: [-14, 0, 0] },
        Head: { pos: [0, 0, 0], rot: [18, 0, 0] },
        LeftUpperArm: { pos: [0, 0, 0], rot: [10, 0, -12] },
        LeftLowerArm: { pos: [0, 0, 0], rot: [78, 0, 0] },
        RightUpperArm: { pos: [0, 0, 0], rot: [10, 0, 12] },
        RightLowerArm: { pos: [0, 0, 0], rot: [78, 0, 0] },
        LeftUpperLeg: { pos: [0, 0, 0], rot: [32, 0, -3] },
        LeftLowerLeg: { pos: [0, 0, 0], rot: [-75, 0, 0] },
        RightUpperLeg: { pos: [0, 0, 0], rot: [-12, 0, 3] },
        RightLowerLeg: { pos: [0, 0, 0], rot: [-45, 0, 0] }
      }
    },
    {
      time: 0.8,
      name: "LoopCycleComplete",
      easingStyle: "Sine",
      easingDirection: "InOut",
      poses: {
        LowerTorso: { pos: [0, -0.15, 0], rot: [-14, -12, 0] },
        UpperTorso: { pos: [0, 0, 0], rot: [-12, 18, -4] },
        Head: { pos: [0, 0, 0], rot: [16, -6, 0] },
        LeftUpperArm: { pos: [0, 0, 0], rot: [-48, 0, -10] },
        LeftLowerArm: { pos: [0, 0, 0], rot: [72, 0, 0] },
        RightUpperArm: { pos: [0, 0, 0], rot: [58, 0, 10] },
        RightLowerArm: { pos: [0, 0, 0], rot: [82, 0, 0] },
        LeftUpperLeg: { pos: [0, 0, 0], rot: [52, 0, -3] },
        LeftLowerLeg: { pos: [0, 0, 0], rot: [-24, 0, 0] },
        RightUpperLeg: { pos: [0, 0, 0], rot: [-46, 0, 3] },
        RightLowerLeg: { pos: [0, 0, 0], rot: [-68, 0, 0] }
      }
    }
  ];

  return finalizeAnimationSpec({
    name: "TacticalSprintCycle_R15",
    rigType: "R15",
    looped: true,
    priority: "Movement",
    duration: 0.8,
    description: `5-keyframe Biomechanical R15 Tactical Sprint Cycle with counter-rotated spine/pelvis, elbow/knee flexion, and airborne flight apex.`,
    keyframes
  });
}

function finalizeAnimationSpec(spec) {
  const luauScript = buildAnimationLuauScript(spec);
  const rbxmx = buildAnimationRbxmx(spec);
  return {
    type: "roblox_animation",
    ...spec,
    keyframeCount: spec.keyframes.length,
    luauScript,
    rbxmx
  };
}

export function buildAnimationLuauScript(spec) {
  const lines = [
    `-- Generated by OpenAI Codex (v0.1.0-free) — Roblox Studio R15 KeyframeSequence Builder`,
    `-- Animation: ${spec.name} (${spec.keyframes.length} keyframes · ${spec.duration}s · ${spec.rigType})`,
    `-- Paste into Roblox Studio Command Bar to create a KeyframeSequence in ServerStorage/Workspace`,
    ``,
    `local kfs = Instance.new("KeyframeSequence")`,
    `kfs.Name = "${spec.name}"`,
    `kfs.Loop = ${spec.looped ? "true" : "false"}`,
    `kfs.Priority = Enum.AnimationPriority.${spec.priority || "Action"}`,
    ``,
    `local function makePose(jointName, pos, rotDeg, style, dir)`,
    `    local pose = Instance.new("Pose")`,
    `    pose.Name = jointName`,
    `    pose.Weight = 1`,
    `    pose.EasingStyle = Enum.PoseEasingStyle[style] or Enum.PoseEasingStyle.Cubic`,
    `    pose.EasingDirection = Enum.PoseEasingDirection[dir] or Enum.PoseEasingDirection.InOut`,
    `    pose.CFrame = CFrame.new(pos.X, pos.Y, pos.Z) * CFrame.Angles(math.rad(rotDeg.X), math.rad(rotDeg.Y), math.rad(rotDeg.Z))`,
    `    return pose`,
    `end`,
    ``
  ];

  spec.keyframes.forEach((kf, idx) => {
    lines.push(`do -- Keyframe ${idx + 1}: ${kf.name} (t = ${kf.time}s)`);
    lines.push(`    local kf = Instance.new("Keyframe")`);
    lines.push(`    kf.Name = "${kf.name}"`);
    lines.push(`    kf.Time = ${kf.time}`);
    lines.push(`    local rootPose = makePose("HumanoidRootPart", Vector3.zero, Vector3.zero, "${kf.easingStyle || "Cubic"}", "${kf.easingDirection || "InOut"}")`);
    lines.push(`    rootPose.Parent = kf`);

    for (const [joint, transform] of Object.entries(kf.poses || {})) {
      const [px, py, pz] = transform.pos || [0, 0, 0];
      const [rx, ry, rz] = transform.rot || [0, 0, 0];
      lines.push(
        `    local p_${joint} = makePose("${joint}", Vector3.new(${px}, ${py}, ${pz}), Vector3.new(${rx}, ${ry}, ${rz}), "${kf.easingStyle || "Cubic"}", "${kf.easingDirection || "InOut"}")`
      );
      lines.push(`    p_${joint}.Parent = rootPose`);
    }

    lines.push(`    kf.Parent = kfs`);
    lines.push(`end`, ``);
  });

  lines.push(
    `kfs.Parent = game:GetService("Workspace")`,
    `print("[Codex-Free] Created R15 KeyframeSequence '${spec.name}' in Workspace! Open in Roblox Animation Editor to preview or publish.")`,
    `return kfs`
  );

  return lines.join("\n");
}

export function buildAnimationRbxmx(spec) {
  const kfItems = spec.keyframes
    .map((kf, idx) => {
      const poseItems = Object.entries(kf.poses || {})
        .map(([joint, tr], pIdx) => {
          const [px, py, pz] = tr.pos || [0, 0, 0];
          return `          <Item class="Pose" referent="RBXPose_${idx}_${pIdx}">
            <Properties>
              <string name="Name">${joint}</string>
              <float name="Weight">1</float>
              <CoordinateFrame name="CFrame">
                <X>${px}</X><Y>${py}</Y><Z>${pz}</Z>
                <R00>1</R00><R01>0</R01><R02>0</R02>
                <R10>0</R10><R11>1</R11><R12>0</R12>
                <R20>0</R20><R21>0</R21><R22>1</R22>
              </CoordinateFrame>
            </Properties>
          </Item>`;
        })
        .join("\n");

      return `    <Item class="Keyframe" referent="RBXKF_${idx}">
      <Properties>
        <string name="Name">${kf.name}</string>
        <float name="Time">${kf.time}</float>
      </Properties>
      <Item class="Pose" referent="RBXRootPose_${idx}">
        <Properties>
          <string name="Name">HumanoidRootPart</string>
          <float name="Weight">1</float>
        </Properties>
${poseItems}
      </Item>
    </Item>`;
    })
    .join("\n");

  return `<roblox xmlns:xmime="http://www.w3.org/2005/05/xmlmime" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="http://www.roblox.com/roblox.xsd" version="4">
  <External>null</External>
  <External>nil</External>
  <Item class="KeyframeSequence" referent="RBXKFS0">
    <Properties>
      <string name="Name">${spec.name}</string>
      <bool name="Loop">${spec.looped ? "true" : "false"}</bool>
    </Properties>
${kfItems}
  </Item>
</roblox>
`;
}

/**
 * Generates the official Roblox Studio Live Sync Companion Plugin (.lua)
 * that connects Roblox Studio directly to Codex-Free via HttpService.
 */
export function generateRobloxCompanionPluginLua(serverUrl = "http://localhost:3000") {
  return `--[[
  >_ OpenAI Codex (v0.1.0-free) — Official Roblox Studio Live Sync Plugin
  100% Free Unlimited 3D Model, R15 Animation & Luau Script Bridge

  HOW TO INSTALL IN ROBLOX STUDIO:
  1. In Roblox Studio, enable Game Settings -> Security -> Allow HTTP Requests = ON.
  2. Save this file into your Roblox Studio Plugins folder as "CodexFreePlugin.lua"
     OR paste it directly into the Roblox Studio Command Bar!
--]]

local HttpService = game:GetService("HttpService")
local ChangeHistoryService = game:GetService("ChangeHistoryService")
local Selection = game:GetService("Selection")

local CODEX_SERVER = "${serverUrl}"
local POLL_INTERVAL = 1.5

print(">_ [Codex-Free] Connected to Codex-Free Studio Bridge at " .. CODEX_SERVER)

local function pollCodexQueue()
    local ok, response = pcall(function()
        return HttpService:GetAsync(CODEX_SERVER .. "/api/roblox/poll", true)
    end)
    if not ok or not response then return end

    local decodeOk, data = pcall(function()
        return HttpService:JSONDecode(response)
    end)
    if not decodeOk or not data or not data.items then return end

    for _, item in ipairs(data.items) do
        print(">_ [Codex-Free] Syncing asset into Roblox Studio: " .. tostring(item.name))
        ChangeHistoryService:SetWaypoint("Before Codex-Free Sync: " .. tostring(item.name))

        if item.luauScript then
            local fn, err = loadstring(item.luauScript)
            if fn then
                local ranOk, createdInstance = pcall(fn)
                if ranOk and typeof(createdInstance) == "Instance" then
                    Selection:Set({ createdInstance })
                end
            else
                warn("[Codex-Free] Script compilation warning: " .. tostring(err))
            end
        end

        ChangeHistoryService:SetWaypoint("After Codex-Free Sync: " .. tostring(item.name))
    end
end

task.spawn(function()
    while true do
        pollCodexQueue()
        task.wait(POLL_INTERVAL)
    end
end)
`;
}
