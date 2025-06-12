// Import modules with adjectives, nouns, and death types.
import { abstractEdgyAdjectives } from "./constants/edgyAdjectives.js";
import { wittyNouns } from "./constants/wittyNouns.js";
import { waysToDie } from "./constants/deathsMethods.js";
import { murderMethods } from "./constants/murderMethods.js";
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  StringSelectMenuBuilder,
  PermissionsBitField,
  ThreadAutoArchiveDuration,
} = require("discord.js");

const config = require("./config.js");
const fs = require("fs");
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});
let gameState = {
  players: [],
  allPlayers: [],
  originalRoles: {
    mafias: [],
    doctor: null,
    detective: null,
    bodyguard: null,
    mayor: null,
    president: null,
    clown: null,
    citizens: [],
  },
  playerRoles: new Map(),
  currentPhase: "startup",
  mafias: [],
  doctor: null,
  detective: null,
  gameChannel: null,
  gameChannelId: null,
  bodyguard: null,
  mayor: null,
  citizens: [],
  president: null,
  presidentUsedAbility: false,
  gameActive: false,
  protectedPlayer: null,
  shieldedPlayer: null,
  shieldedPlayerRound: null,
  killedPlayer: null,
  clown: null,
  citizenActions: new Map(),
  citizenPhaseEnded: false,
  citizensUsedAbility: [],
  votes: new Map(),
  skipVotes: 0,
  totalVotes: 0,
  mafiaActions: new Map(),
  doctorActionTaken: false,
  doctorPhaseEnded: false,
  detectiveUsedAbility: false,
  hasPresident: false,
  bodyguardUsedAbility: false,
  bodyguardPhaseEnded: false,
  gameMessage: null,
  mafiaMessages: new Map(),
  mafiaInteractions: new Map(),
  doctorInteraction: null,
  detectiveInteraction: null,
  bodyguardInteraction: null,
  detectivePhaseEnded: false,
  mayorInteraction: null,
  votePhaseActive: false,
  mafiaPhaseEnded: false,
  currentRound: 0,
  mafiaThread: null,
  mafiaThreadId: null,
  startNow: false,
  voteMessage: null,
  voteEmbed: null,
  graveyard: null,
  graveyardId: null,
  gameName: null,
  detectiveTarget: null,
};
const interactions = new Map();
let gameInterval = null;
let gameTimeouts = [];

function saveGameState() {
  var stateToSave = { ...gameState };
  stateToSave.graveyardId = gameState.graveyard.id;
  stateToSave.gameChannelId = gameState.gameChannel.id;
  stateToSave.mafiaThreadId = gameState.mafiaThread.id;
  stateToSave.gameChannel = null;
  stateToSave.mafiaThread = null;
  stateToSave.graveyard = null;
  fs.writeFile(
    "gameState.json",
    JSON.stringify(stateToSave),
    "utf8",
    function () {
      return;
    }
  );
}

client.on("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
  console.log(`Code by Wick Studio`);
  console.log(`discord.gg/wicks`);
  // resetGame();
});

client.on("messageCreate", async (message) => {
  try {
    if (message.author.bot) return;
    const member = message.member;

    if (message.content === "-mafia") {
      if (!member.roles.cache.has(config.allowedRoleId)) {
        await message.reply(
          "❌ **You do not have permission to start the game.**"
        );
        return;
      }

      if (gameState.gameActive) {
        await message.channel.send("⚠️ **The game is already in progress.**");
        return;
      }
      gameState.gameChannel = message.channel;

      await startGame(message);
    }
    if (message.content === "-startEarly") {
      if (!member.roles.cache.has(config.allowedRoleId)) {
        await message.reply(
          "❌ **You do not have permission to start the game.**"
        );
        return;
      }
      gameState.startNow = true;
    }
    if (message.content === "-restartmafia") {
      if (!member.roles.cache.has(config.allowedRoleId)) {
        await message.reply(
          "❌ **You do not have permission to start the game.**"
        );
        return;
      }

      fs.readFile(
        "gameState.json",
        "utf8",
        async function readFileCallback(err, data) {
          if (err) {
            console.log(err);
          } else {
            gameState = JSON.parse(data); //now it an object
            gameState.gameChannel = message.channel;

            gameState.playerRoles = new Map();
            for (const mafia of gameState.originalRoles.mafias) {
              gameState.playerRoles.set(mafia, "mafia");
            }
            gameState.playerRoles.set(gameState.originalRoles.doctor, "doctor");
            gameState.playerRoles.set(
              gameState.originalRoles.detective,
              "detective"
            );
            gameState.playerRoles.set(
              gameState.originalRoles.bodyguard,
              "bodyguard"
            );
            gameState.playerRoles.set(gameState.originalRoles.mayor, "mayor");
            gameState.playerRoles.set(
              gameState.originalRoles.president,
              "president"
            );
            gameState.playerRoles.set(gameState.originalRoles.clown, "clown");
            for (const player of gameState.players) {
              if (!gameState.playerRoles.has(player)) {
                gameState.playerRoles.set(player, "citizen");
              }
            }
            gameState.citizenActions = new Map();
            gameState.mafiaActions = new Map();
            gameState.votes = new Map();
            gameState.gameChannel = message.channel;
            if (gameState.gameChannel == null) {
              gameState.gameChannel = await client.channels.get(
                "1373451640551768094"
              );
            }
            if (gameState.mafiaThread != null) {
              gameState.mafiaThread = await client.channels.fetch(
                gameState.mafiaThread.id
              );
            } else {
              if (gameState.mafiaThreadId != null) {
                gameState.mafiaThread =
                  gameState.gameChannel.threads.cache.find(
                    (x) => x.id === gameState.mafiaThreadId
                  );
              }
            }
            if (gameState.graveyardId != null) {
              gameState.graveyard = gameState.gameChannel.threads.cache.find(
                (x) => x.id === gameState.graveyardId
              );
            }
            switch (gameState.currentPhase) {
              case "roles":
                assignRoles(message.channel);
                return;
              case "night":
                startNightPhase(message.channel);
                return;

              case "day":
                startVotePhase(message.channel);
                return;
              default:
                message.channel.send(
                  "Uh oh gamestate restore did a fucky wucky"
                );
            }
          }
        }
      );
    }
  } catch (error) {
    console.error("Error in messageCreate:", error);
    await message.channel.send(
      "❌ **An unexpected error occurred while processing the message.**"
    );
  }
});
async function sendPlayerMessage(playerId, message) {
  var player = client.users.cache.get(playerId);
  if (player) {
    player.send(message);
  } else {
    player = await client.users.fetch(playerId);

    if (player) {
      player.send(message);
      return;
    }
  }
}

async function startGame(message) {
  try {
    resetGame();
    gameState.gameActive = true;
    gameState.allPlayers = [];
    gameState.gameName =
      abstractEdgyAdjectives.sort(() => Math.random() - 0.5)[0] +
      "-" +
      wittyNouns.sort(() => Math.random() - 0.5)[0];
    const embed = new EmbedBuilder()
      .setTitle(`🔥 **Mafia Game: ${gameState.gameName}** 🔥`)
      .setDescription(
        `Click the button below to join the game.\n\nThe game will start in ${
          config.startTime / 1000
        } seconds.`
      )
      .setColor("#FF4500")
      .setThumbnail(client.user.displayAvatarURL())
      .addFields(
        {
          name: "Number of Players",
          value: `0/${config.maxPlayers}`,
          inline: true,
        },
        {
          name: "Time Remaining",
          value: `${config.startTime / 1000} seconds`,
          inline: true,
        },
        {
          name: "Joined Players",
          value: "No players yet.",
        }
      )
      .setFooter({ text: "Join now and enjoy the game!" })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("join_game")
        .setLabel("Join Game")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("leave_game")
        .setLabel("Leave Game")
        .setStyle(ButtonStyle.Danger)
    );

    gameState.gameMessage = await message.channel.send({
      embeds: [embed],
      components: [row],
    });

    let timeLeft = config.startTime / 60000;
    gameInterval = setInterval(async () => {
      try {
        timeLeft--;

        const joinedPlayers = gameState.players.length
          ? gameState.players.map((id) => `<@${id}>`).join(", ")
          : "No players yet.";

        const allPlayers = gameState.allPlayers.length
          ? gameState.allPlayers.map((id) => `<@${id}>`).join(", ")
          : "No players yet.";

        const updatedEmbed = EmbedBuilder.from(embed)
          .setFields(
            {
              name: "Number of Players",
              value: `${gameState.players.length}/${config.maxPlayers}`,
              inline: true,
            },
            {
              name: "Time Remaining",
              value: `${timeLeft} minutes`,
              inline: true,
            },
            {
              name: "Joined Players",
              value: joinedPlayers,
            }
          )
          .setDescription(
            `Click the button below to join the game.\n\nThe game will start soon!`
          );

        if (timeLeft <= 0 || gameState.startNow) {
          clearInterval(gameInterval);
          gameInterval = null;

          const disabledRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId("join_game")
              .setLabel("Join Game")
              .setStyle(ButtonStyle.Success)
              .setDisabled(true),
            new ButtonBuilder()
              .setCustomId("leave_game")
              .setLabel("Leave Game")
              .setStyle(ButtonStyle.Danger)
              .setDisabled(true)
          );

          if (gameState.gameMessage) {
            await gameState.gameMessage
              .edit({
                embeds: [updatedEmbed],
                components: [disabledRow],
              })
              .catch((error) => {
                console.error("Error editing game message:", error);
              });
          }

          if (gameState.players.length >= config.minPlayers) {
            await assignRoles(message.channel);
          } else {
            gameState.gameActive = false;
            await message.channel.send(
              "❌ **Not enough players joined. The game has been canceled.**"
            );
            resetGame();
          }
        } else {
          if (gameState.gameMessage) {
            await gameState.gameMessage
              .edit({ embeds: [updatedEmbed], components: [row] })
              .catch((error) => {
                console.error("Error editing game message:", error);
                gameState.gameMessage = null;
              });
          }
        }
      } catch (error) {
        console.error("Error in game interval:", error);
      }
    }, 60000);
  } catch (error) {
    console.error("Error in startGame:", error);
    await message.channel.send(
      "❌ **An error occurred while starting the game.**"
    );
  }
}

client.on("interactionCreate", async (interaction) => {
  try {
    if (!interaction.isButton()) return;

    const { customId } = interaction;

    if (customId === "join_game") {
      if (gameState.players.length >= config.maxPlayers) {
        await interaction.reply({
          content: "❌ **Maximum number of players reached.**",
          ephemeral: true,
        });
        return;
      }

      if (!gameState.players.includes(interaction.user.id)) {
        gameState.players.push(interaction.user.id);
        if (!gameState.allPlayers.includes(interaction.user.id)) {
          gameState.allPlayers.push(interaction.user.id);
        }

        interactions.set(interaction.user.id, interaction);
        await interaction.reply({
          content: "✅ **You have joined the game!**",
          ephemeral: true,
        });
        console.log(interaction.user.id);
      } else {
        await interaction.reply({
          content: "❌ **You are already in the game!**",
          ephemeral: true,
        });
      }
    } else if (customId === "leave_game") {
      if (gameState.players.includes(interaction.user.id)) {
        gameState.players = gameState.players.filter(
          (id) => id !== interaction.user.id
        );
        await interaction.reply({
          content: "❌ **You have left the game.**",
          ephemeral: true,
        });
      } else {
        await interaction.reply({
          content: "❌ **You are not in the game.**",
          ephemeral: true,
        });
      }
    } else if (
      customId.startsWith("vibeFrom_") &&
      gameState.currentPhase == "night"
    ) {
      await handleCitizenVibeFrom(interaction);
    } else if (
      customId.startsWith("vibeTo_") &&
      gameState.currentPhase == "night"
    ) {
      await handleCitizenVibeTo(interaction);
    } else if (
      customId.startsWith("skip_vibe") &&
      gameState.currentPhase == "night"
    ) {
      await handleCitizenSkipVibe(interaction);
    } else if (
      customId.startsWith("kill_") &&
      gameState.currentPhase == "night"
    ) {
      await handleMafiaKill(interaction);
    } else if (
      customId.startsWith("protect_") &&
      gameState.currentPhase == "night"
    ) {
      await handleDoctorProtect(interaction);
    } else if (
      customId.startsWith("detect_") &&
      gameState.currentPhase == "night"
    ) {
      await handledetectiveDetect(interaction);
    } else if (
      customId === "skip_detect" &&
      gameState.currentPhase == "night"
    ) {
      await handledetectiveSkip(interaction);
    } else if (
      customId.startsWith("shield_") &&
      gameState.currentPhase == "night"
    ) {
      await handleBodyguardShield(interaction);
      // } else if (customId === "skip_shield") {
      //  await handleBodyguardSkip(interaction);
    } else if (customId.startsWith("vote_")) {
      await handleVote(interaction);
    } else if (customId === "skip_vote") {
      await handleSkipVote(interaction);
    } else if (customId === "president_ability") {
      await handlePresidentAbility(interaction);
    } else if (customId.startsWith("president_select_")) {
      await handlePresidentSelection(interaction);
    }
  } catch (error) {
    console.error("Error in interactionCreate:", error);
    if (!interaction.replied) {
      await interaction.reply({
        content: "❌ **An unexpected error occurred. Please try again.**",
        ephemeral: true,
      });
    }
  }
});

async function sendPlayerToHell(playerId) {
  if (gameState.graveyard != null) {
    console.log(JSON.stringify(gameState.graveyard));
    if (typeof gameState.graveyard.members.add != "function") {
      gameState.graveyard = gameState.gameChannel.threads.cache.find(
        (x) => x.id === gameState.graveyard.id
      );
    }
    await gameState.graveyard.members.add(playerId);
    await gameState.graveyard.send(
      `<@${playerId}>\n💀 **You have died! Welcome to the graveyard where you can discuss the realm of the living without fear of spoiling the game for others**`
    );
  }
}
async function assignRoles(channel) {
  try {
    if (!gameState.gameActive) return;
    gameState.currentPhase = "roles";
    saveGameState();

    gameState.allPlayers = [...gameState.players];
    const shuffledPlayers = [...gameState.players].sort(
      () => Math.random() - 0.5
    );
    gameState.hasPresident = shuffledPlayers.length >= 7;
    if (shuffledPlayers.length < 6) {
      await channel.send(
        "❌ **Not enough players to assign all roles. You need at least 6 players.**"
      );
      resetGame();
      return;
    }

    let mafiaCount = 1;
    if (shuffledPlayers.length >= 8) {
      mafiaCount = 2;
    }
    if (shuffledPlayers.length >= 12) {
      mafiaCount = 3;
    }
    if (shuffledPlayers.length >= 16) {
      mafiaCount = 4;
    }

    gameState.mafias = shuffledPlayers.slice(0, mafiaCount);
    gameState.originalRoles.mafias = [...gameState.mafias];
    gameState.doctor = shuffledPlayers[mafiaCount];
    gameState.originalRoles.doctor = gameState.doctor;
    gameState.detective = shuffledPlayers[mafiaCount + 1];
    gameState.originalRoles.detective = gameState.detective;
    gameState.bodyguard = shuffledPlayers[mafiaCount + 2];
    gameState.originalRoles.bodyguard = gameState.bodyguard;
    gameState.mayor = shuffledPlayers[mafiaCount + 3];
    gameState.originalRoles.mayor = gameState.mayor;
    gameState.clown = shuffledPlayers[mafiaCount + 4];
    gameState.originalRoles.clown = gameState.clown;
    if (gameState.hasPresident) {
      gameState.president = shuffledPlayers[mafiaCount + 5];
      gameState.originalRoles.president = gameState.president;
    }
    shuffledPlayers
      .slice(mafiaCount + (gameState.hasPresident ? 6 : 5))
      .forEach((player) => {
        gameState.playerRoles.set(player, "citizen");
        gameState.citizens.push(player);
        gameState.originalRoles.push(player);
      });

    for (const mafia of gameState.mafias) {
      gameState.playerRoles.set(mafia, "mafia");
    }
    for (const mafia of gameState.citizens) {
      gameState.playerRoles.set(mafia, "citizen");
    }
    gameState.playerRoles.set(gameState.doctor, "doctor");
    gameState.playerRoles.set(gameState.detective, "detective");
    gameState.playerRoles.set(gameState.bodyguard, "bodyguard");
    gameState.playerRoles.set(gameState.mayor, "mayor");
    gameState.playerRoles.set(gameState.clown, "clown");
    if (gameState.hasPresident) {
      gameState.playerRoles.set(gameState.president, "president");
    }
    for (const playerId of gameState.players) {
      const role = gameState.playerRoles.get(playerId);
      console.log(playerId, role.toUpperCase());
      sendPlayerMessage(
        playerId,
        `🎭 **Your role is:** **${role.toUpperCase()}**.`
      );
      if (playerId === gameState.clown) {
        sendPlayerMessage(
          playerId,
          `As clown, you have a unique win condition. You win if and only if the town votes to kill you. If you make it to the end of the game alive, or get killed by the mafia; you lose. `
        );
      }
    }
    gameState.graveyard = await channel.threads.create({
      name: `GRAVEYARD -${gameState.gameName} `,
      autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
      type: ChannelType.PrivateThread,
      invitable: false,
    });
    if (gameState.mafias.length >= 2) {
      try {
        const mafiaThread = await channel.threads.create({
          name: `Mafia Chat -${gameState.gameName} `,
          autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
          type: ChannelType.PrivateThread,
          invitable: false,
        });

        for (const mafiaId of gameState.mafias) {
          await mafiaThread.members.add(mafiaId).catch((error) => {
            console.error(
              `Error adding mafia member ${mafiaId} to thread:`,
              error
            );
          });
        }

        gameState.mafiaThread = mafiaThread;

        const mafiaMentions = gameState.mafias
          .map((id) => `<@${id}>`)
          .join(", ");

        await mafiaThread.send(
          `${mafiaMentions}\n💀 **This is the mafia chat. You can discuss your plans here.**`
        );
      } catch (error) {
        console.error("Error creating mafia thread:", error);
        await channel.send(
          "❌ **An error occurred while creating the mafia chat.**"
        );
      }
    }

    const embed = new EmbedBuilder()
      .setTitle("📋 **Players Report**")
      .setDescription(
        "**Roles have been assigned to players. Here are the game details:**"
      )
      .setColor("#1E90FF")
      .addFields(
        {
          name: "👥 **Number of Players**",
          value: `${gameState.players.length}`,
          inline: true,
        },
        {
          name: "💀 **Number of Mafia**",
          value: `${mafiaCount}`,
          inline: true,
        },
        { name: "💉 **Number of Doctors**", value: `1`, inline: true },
        { name: "🕵️‍♂️ **Number of Detectives**", value: `1`, inline: true },
        { name: "🛡️ **Number of Bodyguards**", value: `1`, inline: true },
        { name: "👑 **Number of Mayors**", value: `1`, inline: true },
        {
          name: "👨‍🌾 **Number of Citizens**",
          value: `${gameState.citizens.length}`,
          inline: true,
        },
        { name: "🤡 **Number of Clowns**", value: `1`, inline: true },
        {
          name: "🥇 **Number of Presidents**",
          value: `${gameState.hasPresident ? 1 : 0}`,
          inline: true,
        },
        {
          name: "All Players",
          value:
            gameState.allPlayers.map((id) => `<@${id}>`).join(", ") ||
            "No players yet.",
          inline: false,
        }
      )
      .setFooter({ text: "Good luck everyone!" })
      .setTimestamp();

    await channel.send({ embeds: [embed] });

    await channel.send(
      "🚨 **Roles have been revealed to all players. The game will start in 5 seconds.**"
    );
    saveGameState();

    const timeout = setTimeout(() => startNightPhase(channel), 5000);
    gameTimeouts.push(timeout);
  } catch (error) {
    console.error("Error in assignRoles:", error);
    await channel.send("❌ **An error occurred while assigning roles.**");
  }
}

function resetGame() {
  let gameState = {
    players: [],
    allPlayers: [],
    originalRoles: {
      mafias: [],
      doctor: null,
      detective: null,
      bodyguard: null,
      mayor: null,
      president: null,
      clown: null,
      citizens: [],
    },
    playerRoles: new Map(),
    currentPhase: "startup",
    mafias: [],
    doctor: null,
    detective: null,
    gameChannel: null,
    gameChannelId: null,
    bodyguard: null,
    mayor: null,
    citizens: [],
    president: null,
    presidentUsedAbility: false,
    gameActive: false,
    protectedPlayer: null,
    shieldedPlayer: null,
    shieldedPlayerRound: null,
    killedPlayer: null,
    clown: null,
    citizenActions: new Map(),
    citizenPhaseEnded: false,
    citizensUsedAbility: [],
    votes: new Map(),
    skipVotes: 0,
    totalVotes: 0,
    mafiaActions: new Map(),
    doctorActionTaken: false,
    doctorPhaseEnded: false,
    detectiveUsedAbility: false,
    hasPresident: false,
    bodyguardUsedAbility: false,
    bodyguardPhaseEnded: false,
    gameMessage: null,
    mafiaMessages: new Map(),
    mafiaInteractions: new Map(),
    doctorInteraction: null,
    detectiveInteraction: null,
    bodyguardInteraction: null,
    detectivePhaseEnded: false,
    mayorInteraction: null,
    votePhaseActive: false,
    mafiaPhaseEnded: false,
    currentRound: 0,
    mafiaThread: null,
    mafiaThreadId: null,
    startNow: false,
    voteMessage: null,
    voteEmbed: null,
    graveyard: null,
    graveyardId: null,
    gameName: null,
    detectiveTarget: null,
  };
  interactions.clear();
  if (gameState && gameState.gameMessage) {
    disableButtons(gameState.gameMessage);
  }

  if (gameState.mafiaThread) {
    try {
      gameState.mafiaThread.delete().catch((error) => {
        console.error("Error deleting mafia thread:", error);
      });
      gameState.mafiaThread = null;
    } catch (error) {
      console.error("Error deleting mafia thread:", error);
    }
  }
  if (gameInterval) {
    clearInterval(gameInterval);
    gameInterval = null;
  }

  console.log("Game state has been reset.");
}

async function disableButtons(message) {
  if (!message) return;
  try {
    const fetchedMessage = await message.fetch().catch((error) => {
      if (error.code === 10008) {
        console.error("Message was deleted before it could be fetched.");
        return null;
      } else {
        throw error;
      }
    });

    if (!fetchedMessage) return;

    const disabledComponents = fetchedMessage.components.map((row) => {
      return new ActionRowBuilder().addComponents(
        row.components.map((button) =>
          ButtonBuilder.from(button).setDisabled(true)
        )
      );
    });

    await fetchedMessage
      .edit({ components: disabledComponents })
      .catch((error) => {
        console.error("Error editing message to disable buttons:", error);
      });
  } catch (error) {
    if (error.code === 10008) {
      console.error(
        "Error: Tried to disable buttons on a message that no longer exists."
      );
    } else {
      console.error("Error while disabling buttons:", error);
    }
  }
}
async function startNightPhase() {
  gameState.currentPhase = "night";
  saveGameState();
  const embed = new EmbedBuilder()
    .setTitle("🌕🌖🌗🌘🌑 ** THE SUN SETS ** 🌑🌒🌓🌔🌕")
    .setDescription(
      "**With the deliberations of the day finished, night time has begun**"
    )
    .setColor("#280137")
    .addFields(
      {
        name: "💀 **Mafia**",
        value: `The Mafia must choose a victim.`,
        inline: true,
      },
      {
        name: "💉 **Doctor**",
        value: `The doctor must choose a patient.`,
        inline: true,
      },
      {
        name: "🛡️ **Bodyguards**",
        value: `The bodyguard must choose someone to protect.`,
        inline: true,
      },
      {
        name: "🕵️‍♂️ **Detective**",
        value: `The detective *may* choose someone to investigate.`,
        inline: true,
      },
      {
        name: "🤼 **Citizens**",
        value: `The citizens *may* choose two players for a vibe check (see pins).`,
        inline: true,
      },
      {
        name: "🤼 **Everyone**",
        value: `Should be careful about what they post at night.`,
        inline: true,
      }
    )
    .setFooter({ text: "Have a great sleep everyone else!" });

  await gameState.gameChannel.send({ embeds: [embed] });

  if (!gameState.mafiaPhaseEnded) {
    startMafiaPhase(gameState.gameChannel);
  }
  if (!gameState.doctorPhaseEnded) {
    startDoctorPhase(gameState.gameChannel);
  }
  if (!gameState.bodyguardPhaseEnded) {
    startBodyguardPhase(gameState.gameChannel);
  }
  if (!gameState.detectivePhaseEnded) {
    startdetectivePhase(gameState.gameChannel);
  }
  if (!gameState.citizenPhaseEnded) {
    startCitizenPhase(gameState.gamechannel);
  }
  if (
    gameState.detectivePhaseEnded &&
    gameState.bodyguardPhaseEnded &&
    gameState.doctorPhaseEnded &&
    gameState.mafiaPhaseEnded &&
    gameState.citizenPhaseEnded
  ) {
    checkIfNightEnded();
  }
}

async function startCitizenPhase(channel) {
  try {
    if (!gameState.gameActive) return;

    if (gameState.citizenActions != null) {
      gameState.citizenActions.clear();
    }
    var embed = new EmbedBuilder()
      .setTitle("🤸 ** Greeting Citizen **🤸")
      .setDescription(
        "🌋 **Ready for a vibes check? You're gonna pick two different players (other than yourself) and check if they have the same vibes or not. You will not be told what vibes the players had, only if they have the same vibes or not.**"
      )
      .setColor("#4B006E")
      .addFields(
        {
          name: " 👍 The Good 👍",
          value: `Doctor, Detective, Bodyguard, Clown and other Citizens all have good vibes.`,
        },
        {
          name: "👎 The Bad 👎",
          value: `Mafia and the Clown all have bad vibes.`,
        },
        {
          name: "👺 The Ugly 👺",
          value: `The Mayor, President and Clown all have ugly vibes.`,
        }
      )

      .setFooter({
        text: "You can only do this once a game, and may skip until you are ready. If you are ready, pick your first target.",
      });

    for (var citizen in gameState.citizens) {
      if (!gameState.citizensUsedAbility.includes(citizen)) {
        var availableTargets = [...alivePlayers].filter(
          (player) => player != citizen
        );

        const buttons = [];
        for (var i in availableTargets) {
          var target = availableTargets[i];
          var targetObj = channel?.guild?.members.cache.get(target);
          if (targetObj == null) {
            targetObj = await client.users.fetch(target);
          }
          buttons.push(
            new ButtonBuilder()
              .setCustomId(`vibeFrom_${target}`)
              .setLabel(`${targetObj?.displayName || "Unknown"}`)
              .setStyle(ButtonStyle.Success)
          );
        }
        const skipButton = new ButtonBuilder()
          .setCustomId("skip_vibes")
          .setLabel("Skip Vote")
          .setStyle(ButtonStyle.Primary);
        buttons.push(skipButton);
        const rows = createButtonRows(buttons);

        sendPlayerMessage(citizen, {
          embeds: embed,
          components: rows,
        });
      }
    }
  } catch (error) {
    console.error("Error in startCitizenPhase:", error);
    await channel.send("❌ **An error occurred during the citizen phase.**");
  }
}
async function handleCitizenSkipVibe(interaction) {
  try {
    if (!gameState.gameActive || gameState.citizenPhaseEnded) return;

    var citizen = interaction.user.id;
    if (!gameState.citizens.includes(citizen)) {
      await interaction.reply({
        content:
          "❌ **You are not a citizen. Stop clicking old buttons its rude.**",
        ephemeral: true,
      });
      return;
    }
    await interaction.update({
      content:
        "⏩ **You have chosen to skip checking vibes this round. You can still vibe check in a future round.**",
      components: [],
    });
    gameState.citizenActions.set(interaction.user.id, {
      target1: "skip",
      target2: "skip",
    });
    if (gameState.mafiaActions.size === gameState.mafias.length) {
      await resolveCitizenActions(gameState.gameChannel);
    }
  } catch (error) {
    console.error("Error in handleCitizenSkipVibe:", error);
    await channel.send("❌ **An error occurred during the citizen phase.**");
  }
}
async function handleCitizenVibeFrom(interaction) {
  try {
    if (!gameState.gameActive || !gameState.citizenPhaseActive) {
      await interaction.reply({
        content: "❌ **You cannot use this ability now.**",
        ephemeral: true,
      });
      return;
    }

    if (!gameState.citizens.includes(interaction.user.id)) {
      await interaction.reply({
        content: "❌ **This ability is for citizens only.**",
        ephemeral: true,
      });
      return;
    }

    if (gameState.citizensUsedAbility.includes(interaction.user.id)) {
      await interaction.reply({
        content: "❌ **You have already used your ability.**",
        ephemeral: true,
      });
      return;
    }
    var firstTargetId = interaction.customId.split("_")[1];
    var targetObj =
      gameState.gameChannel?.guild?.members?.cache.get(firstTargetId);
    if (targetObj == null || targetObj == undefined) {
      targetObj = await client.users.fetch(target);
      if (targetObj == null) {
        targetObj = await guild?.members.fetch(target);
      }
    }
    var firstTargetName =
      targetObj?.displayName || targetObj?.globalName || "Unknown";

    // Create buttons for the President to select a player
    const alivePlayers = [...gameState.players].filter(
      (player) => player !== interaction.user.id && player !== firstTargetId
    );
    gameState.citizenActions.set(interaction.user.id, {
      target1: firstTargetId,
      target2: null,
    });
    const buttons = [];
    for (var i in alivePlayers) {
      var target = alivePlayers[i];
      var targetObj = gameState.gameChannel?.guild?.members?.cache.get(target);
      if (targetObj == null || targetObj == undefined) {
        targetObj = await client.users.fetch(target);
        if (targetObj == null) {
          targetObj = await guild?.members.fetch(target);
        }
      }
      buttons.push(
        new ButtonBuilder()
          .setCustomId(`vibeTo_${target}`)
          .setLabel(
            `${targetObj?.displayName || targetObj?.globalName || "Unknown"}`
          )
          .setStyle(ButtonStyle.Success)
      );
    }
    const skipButton = new ButtonBuilder()
      .setCustomId("skip_vibes")
      .setLabel("Skip Vibes")
      .setStyle(ButtonStyle.Primary);
    buttons.push(skipButton);
    const rows = createButtonRows(buttons);

    await interaction.reply({
      content: `🙏 **Choose the player you want to compare ${firstTargetName} with for your vibes check.**`,
      components: rows,
      ephemeral: true,
    });
  } catch (error) {
    console.error("Error in handleCitizenVibeFrom:", error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content:
          "❌ **An error occurred while using the ability. Please try again.**",
        ephemeral: true,
      });
    }
  }
}
async function handleCitizenVibeTo(interaction) {
  try {
    if (!gameState.gameActive || !gameState.citizenPhaseActive) {
      await interaction.reply({
        content: "❌ **You cannot use this ability now.**",
        ephemeral: true,
      });
      return;
    }

    if (!gameState.citizens.includes(interaction.user.id)) {
      await interaction.reply({
        content: "❌ **This ability is for citizens only.**",
        ephemeral: true,
      });
      return;
    }

    if (gameState.citizensUsedAbility.includes(interaction.user.id)) {
      await interaction.reply({
        content: "❌ **You have already used your ability.**",
        ephemeral: true,
      });
      return;
    }
    var secondTargetId = interaction.customId.split("_")[1];
    var targetObj =
      gameState.gameChannel?.guild?.members?.cache.get(secondTargetId);
    if (targetObj == null || targetObj == undefined) {
      targetObj = await client.users.fetch(secondTargetId);
      if (targetObj == null) {
        targetObj = await guild?.members.fetch(secondTargetId);
      }
    }

    var secondTargetName =
      targetObj?.displayName || targetObj?.globalName || "Unknown";

    var currentVote = gameState.citizenActions.get(interaction.user.id);
    if (currentVote == null || currentVote == undefined) {
      await interaction.reply({
        content:
          "❌ **You broke the vote somehow, I don't know your first vote anymore. Please try again or contact someone**",
        ephemeral: true,
      });
      return;
    }
    var firstTargetId = currentVote.target1;
    if (firstTargetId == null || !gameState.players.includes(firstTargetId)) {
      await interaction.reply({
        content:
          "❌ **You broke the vote somehow, your first vote was invalid for some reason. Please try again or contact someone**",
        ephemeral: true,
      });
      return;
    }
    var targetObj2 =
      gameState.gameChannel?.guild?.members?.cache.get(firstTargetId);
    if (targetObj2 == null || targetObj2 == undefined) {
      targetObj2 = await client.users.fetch(firstTargetId);
      if (targetObj2 == null) {
        targetObj2 = await guild?.members.fetch(firstTargetId);
      }
    }
    var firstTargetName =
      targetObj2?.displayName || targetObj2?.globalName || "Unknown";

    gameState.citizenActions.set(interaction.user.id, {
      target1: firstTargetId,
      target2: secondTargetId,
    });

    await interaction.reply({
      content: `🔒 **You have decided to check the vibes between ${firstTargetName} and ${secondTargetName}. You will be informed of vibe similarity at the end of the night.**`,
      ephemeral: true,
    });
    var citizensDoneCount = 0;
    for (var [key, value] of gameState.citizenActions) {
      if (value != null && value.target2 != null) {
        citizensDoneCount++;
      }
    }

    if (citizensDoneCount === gameState.citizens.length) {
      await resolveCitizenActions(gameState.gameChannel);
    }
  } catch (error) {
    console.error("Error in handleCitizenVibeTo:", error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content:
          "❌ **An error occurred while using the ability. Please try again.**",
        ephemeral: true,
      });
    }
  }
}
async function resolveCitizenActions(channel) {
  gameState.citizenPhaseEnded = true;

  saveGameState();
  checkIfNightEnded();
}
async function startMafiaPhase(channel) {
  try {
    if (!gameState.gameActive) return;
    gameState.currentRound += 1;

    if (gameState.mafiaActions != null) {
      console.log(typeof gameState.mafiaActions);
      gameState.mafiaActions.clear();
    }
    gameState.mafiaPhaseEnded = false;

    const alivePlayers = gameState.players.filter(
      (player) => !gameState.mafias.includes(player)
    );
    if (alivePlayers.length === 0) {
      await channel.send(
        "🎉 **The mafia wins! All citizens have been eliminated.**"
      );
      gameState.gameActive = false;
      checkWinConditions(channel);
      return;
    }

    let availableTargets = alivePlayers;

    if (availableTargets.length === 0) {
      await channel.send("❌ **There are no players the mafia can kill.**");
      resolveMafiaActions(channel);
      return;
    }

    // await channel.send("💀 **Mafia, it is your turn to choose your victim.**");

    const buttons = [];
    for (var i in availableTargets) {
      var target = availableTargets[i];
      var targetObj = channel?.guild?.members.cache.get(target);
      if (targetObj == null) {
        targetObj = await client.users.fetch(target);
      }
      buttons.push(
        new ButtonBuilder()
          .setCustomId(`kill_${target}`)
          .setLabel(`${targetObj?.displayName || "Unknown"}`)
          .setStyle(ButtonStyle.Danger)
      );
    }

    const rows = createButtonRows(buttons);
    if (gameState.mafiaThread != null) {
      console.log(JSON.stringify(gameState.mafiaThread));
      const message = await gameState.mafiaThread.send({
        content:
          "💀 **You have been chosen as mafia. You must choose a player to kill. If you choose different players, the victim will be chosen randomly.**",
        components: rows,
      });
    } else if (gameState.mafias.length === 1) {
      sendPlayerMessage(gameState.mafias[0], {
        content:
          "💀 **You have been chosen as mafia. You must choose a player to kill. If you choose different players, the victim will be chosen randomly.**",
        components: rows,
      });
    }
  } catch (error) {
    console.error("Error in startMafiaPhase:", error);
    await channel.send("❌ **An error occurred during the mafia phase.**");
  }
}

async function handleMafiaKill(interaction) {
  try {
    if (!gameState.gameActive || gameState.mafiaPhaseEnded) return;

    const mafiaId = interaction.user.id;

    if (!gameState.mafias.includes(mafiaId)) {
      await interaction.reply({
        content: "❌ **You are not a mafia.**",
        ephemeral: true,
      });
      return;
    }

    if (!gameState.mafiaActions.has(mafiaId)) {
      const playerId = interaction.customId.split("_")[1];

      if (
        !gameState.players.includes(playerId) ||
        gameState.mafias.includes(playerId)
      ) {
        await interaction.reply({
          content: "❌ **You cannot kill this player.**",
          ephemeral: true,
        });
        return;
      }

      gameState.mafiaActions.set(mafiaId, playerId);
      var targetObj = gameState.gameChannel?.guild?.members.cache.get(playerId);
      if (targetObj == null) {
        targetObj = await client.users.fetch(playerId);
      }
      await interaction.reply({
        content: `✅ **You have chosen to kill <${targetObj.displayName}>. Wait for the other mafia to choose.**`,
        components: [],
      });

      if (gameState.mafiaActions.size === gameState.mafias.length) {
        await resolveMafiaActions(gameState.gameChannel);
      }
    } else {
      await interaction.reply({
        content: "❌ **You have already made your decision.**",
        ephemeral: true,
      });
    }
  } catch (error) {
    console.error("Error in handleMafiaKill:", error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content:
          "❌ **An error occurred while attempting to kill. Please try again.**",
        ephemeral: true,
      });
    }
  }
}

async function resolveMafiaActions(channel) {
  try {
    if (!gameState.gameActive || gameState.mafiaPhaseEnded) return;
    gameState.mafiaPhaseEnded = true;

    const selectedTargets = Array.from(gameState.mafiaActions.values());

    if (selectedTargets.length === 0) {
      gameState.mafiaPhaseEnded = true;

      saveGameState();
      checkIfNightEnded();
    }
    var targetMap = {};
    let maxKills = 0;
    const targetsWithMostVotes = [];
    for (const targ of selectedTargets) {
      targetMap[targ] = (targetMap[targ] || 0) + 1;
      if (targetMap[targ] > maxKills) {
        maxKills = targetMap[targ];
      }
    }
    for (const targ in targetMap) {
      if (targetMap[targ] === maxKills) {
        targetsWithMostVotes.push(targ);
      }
    }

    let targetToKill;
    if (targetsWithMostVotes.length === 1) {
      targetToKill = targetsWithMostVotes[0];
    } else {
      targetToKill =
        targetsWithMostVotes[
          Math.floor(Math.random() * targetsWithMostVotes.length)
        ];
      //  await channel.send(
      //   `🗡️ **The mafia chose different targets. The victim will be chosen randomly.**`
      //  );
    }
    gameState.killedPlayer = targetToKill;

    var targetObj = channel?.guild?.members.cache.get(targetToKill);
    if (targetObj == null) {
      targetObj = await client.users.fetch(targetToKill);
    }
    if (gameState.mafiaThread != null) {
      await gameState.mafiaThread.send({
        content: `🗡️ **The final victim is <${targetObj.displayName}>.**`,
        ephemeral: true,
      });
    }
    if (gameState.mafias.lenght === 1) {
      sendPlayerMessage(gameState.mafias[0], {
        content: `🗡️ **The final victim is <${targetObj.displayName}>.**`,
        ephemeral: true,
      });
    }
    // await gameState.gameChannel.send(
    //  "💀 **The mafia have finished choosing.**"
    //);

    //await gameState.gameChannel.send(
    // `🗡️ **The mafia have chosen a victim! Now it is the doctor's turn to protect a player.**`
    //);
    gameState.mafiaPhaseEnded = true;

    saveGameState();
    checkIfNightEnded();
  } catch (error) {
    console.error("Error in resolveMafiaActions:", error);
  }
}

async function handleDoctorProtect(interaction) {
  try {
    if (!gameState.gameActive || gameState.doctorPhaseEnded) return;

    if (!gameState.doctorActionTaken) {
      const playerId = interaction.customId.split("_")[1];

      if (!gameState.players.includes(playerId)) {
        await interaction.reply({
          content: "❌ **You cannot protect this player.**",
          ephemeral: true,
        });
        return;
      }

      gameState.protectedPlayer = playerId;
      gameState.doctorActionTaken = true;

      await interaction.update({
        content: `✅ **You have chosen to protect <@${playerId}>.**`,
        components: [],
      });

      //  await gameState.gameChannel.send(
      //      "💉 **The doctor has protected a player.**"
      //  );

      gameState.doctorPhaseEnded = true;
      saveGameState();
      checkIfNightEnded();
    } else {
      if (!interaction.deferred)
        await interaction.deferReply({ ephemeral: true });
      await interaction.followUp({
        content: "❌ **You have already made your decision.**",
        ephemeral: true,
      });
    }
  } catch (error) {
    console.error("Error in handleDoctorProtect:", error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: "❌ **An error occurred while protecting. Please try again.**",
        ephemeral: true,
      });
    }
  }
}

async function startDoctorPhase(channel) {
  try {
    if (!gameState.gameActive) return;
    gameState.doctorActionTaken = false;
    gameState.doctorPhaseEnded = false;

    const alivePlayers = gameState.players;

    if (!alivePlayers.includes(gameState.doctor)) {
      //await gameState.gameChannel.send(
      //   "💉 **The doctor is not present. Moving to the next phase.**"
      //);
      gameState.doctorPhaseEnded = true;
      saveGameState();
      checkIfNightEnded();
      return;
    }
    //await gameState.gameChannel.send(
    //  "💉 **Doctor, it is your turn to protect a player.**"
    //);
    const buttons = [];
    for (var i in alivePlayers) {
      var target = alivePlayers[i];
      if (target != gameState.protectedPlayer) {
        var targetObj = channel?.guild?.members.cache.get(target);
        if (targetObj == null) {
          targetObj = await client.users.fetch(target);
        }
        buttons.push(
          new ButtonBuilder()
            .setCustomId(`protect_${target}`)
            .setLabel(`${targetObj.displayName || "Unknown"}`)
            .setStyle(ButtonStyle.Primary)
        );
      }
    }
    const rows = createButtonRows(buttons);
    sendPlayerMessage(gameState.doctor, {
      content:
        "💉 **You have been chosen as the doctor. You can protect any player, including yourself, from being killed. You cannot pick the same player two nights in a row.**",
      components: rows,
    });
  } catch (error) {
    console.error("Error in startDoctorPhase:", error);
    await gameState.gameChannel.send(
      "❌ **An error occurred during the doctor phase.**"
    );
  }
}

async function startBodyguardPhase(channel) {
  try {
    if (!gameState.gameActive) return;
    if (!gameState.players.includes(gameState.bodyguard)) {
      //  await gameState.gameChannel.send(
      //      "🛡️ **The bodyguard is not present so skipping.**"
      //  );
      gameState.bodyguardPhaseEnded = true;
      saveGameState();
      checkIfNightEnded();
      return;
    }

    gameState.bodyguardPhaseEnded = false;

    // await gameState.gameChannel.send(
    //  "🛡️ **Bodyguard, it is your turn to choose a player to protect. Keep in mind you will die for them if they are targeted by the mafia**"
    //);

    const alivePlayers = gameState.players.filter(
      (player) => player !== gameState.bodyguard
    );
    const buttons = [];
    for (var i in alivePlayers) {
      var target = alivePlayers[i];
      if (target != gameState.shieldedPlayer) {
        var targetObj = channel?.guild?.members.cache.get(target);
        if (targetObj == null) {
          targetObj = await client.users.fetch(target);
        }
        buttons.push(
          new ButtonBuilder()
            .setCustomId(`shield_${target}`)
            .setLabel(`${targetObj?.displayName || "Unknown"}`)
            .setStyle(ButtonStyle.Primary)
        );
      }
    }
    const rows = createButtonRows([...buttons]);

    sendPlayerMessage(gameState.bodyguard, {
      content:
        "🛡️ **You are the bodyguard. You can protect any player except the player you picked last turn and sacrifice yourself instead of them.**",
      components: rows,
      ephemeral: true,
    });
  } catch (error) {
    console.error("Error in startBodyguardPhase:", error);
    await channel.send("❌ **An error occurred during the bodyguard phase.**");
  }
}

async function handleBodyguardShield(interaction) {
  try {
    if (!gameState.gameActive || gameState.bodyguardPhaseEnded) return;

    const playerId = interaction.customId.split("_")[1];

    if (!gameState.players.includes(playerId)) {
      await interaction.reply({
        content: "❌ **You cannot protect this player.**",
        ephemeral: true,
      });
      return;
    }

    gameState.shieldedPlayer = playerId;

    await interaction.update({
      content: `✅ **You have decided to protect <@${playerId}>. If the mafia targets them, you will be killed instead.**`,
      components: [],
    });

    //await gameState.gameChannel.send(
    //   `🛡️ **The bodyguard has chosen whomst to protect.**`
    // );

    gameState.bodyguardPhaseEnded = true;
    saveGameState();
    checkIfNightEnded();
  } catch (error) {
    console.error("Error in handleBodyguardShield:", error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content:
          "❌ **An error occurred while trying to protect.Please try again.**",
        ephemeral: true,
      });
    }
  }
}
/* 
async function handleBodyguardSkip(interaction) {
  try {
    if (!gameState.gameActive || gameState.bodyguardPhaseEnded) return;

    if (gameState.bodyguardUsedAbility) {
      await interaction.reply({
        content: "❌ **You have already used your shield ability.**",
        ephemeral: true,
      });
      return;
    }

    await interaction.update({
      content:
        "⏩ **You have chosen to skip giving a shield this round. You can use it in a future round.**",
      components: [],
    });

    await gameState.gameChannel.send(
      `🛡️ **The bodyguard decided not to give a shield this round.**`
    );

    gameState.bodyguardPhaseEnded = true;
    startdetectivePhase(gameState.gameChannel);
  } catch (error) {
    console.error("Error in handleBodyguardSkip:", error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content:
          "❌ **An error occurred while trying to skip. Please try again.**",
        ephemeral: true,
      });
    }
  }
} */

async function startdetectivePhase(channel) {
  try {
    if (!gameState.gameActive) return;

    if (
      gameState.detectiveUsedAbility ||
      !gameState.players.includes(gameState.detective)
    ) {
      gameState.detectivePhaseEnded = true;
      saveGameState();
      checkIfNightEnded();
      return;
    }

    // await channel.send(
    //  "🕵️ **Detective, it is your turn to reveal a player's role.**"
    // );

    const alivePlayers = gameState.players.filter(
      (player) => player !== gameState.detective
    );
    const buttons = [];
    for (var i in alivePlayers) {
      var target = alivePlayers[i];
      var targetObj = channel?.guild?.members.cache.get(target);
      if (targetObj == null) {
        targetObj = await client.users.fetch(target);
      }
      buttons.push(
        new ButtonBuilder()
          .setCustomId(`detect_${target}`)
          .setLabel(`${targetObj?.displayName || "Unknown"}`)
          .setStyle(ButtonStyle.Primary)
      );
    }

    const skipButton = new ButtonBuilder()
      .setCustomId("skip_detect")
      .setLabel("Skip Detection")
      .setStyle(ButtonStyle.Secondary);

    const rows = createButtonRows([...buttons, skipButton]);

    sendPlayerMessage(gameState.detective, {
      content:
        "🕵️ **You have been chosen as the detective. You can reveal a player's role once in the game.**",
      components: rows,
      ephemeral: true,
    });
  } catch (error) {
    console.error("Error in startdetectivePhase:", error);
    await channel.send("❌ **An error occurred during the detective phase.**");
  }
}

async function handledetectiveDetect(interaction) {
  try {
    if (!gameState.gameActive) return;

    if (gameState.detectiveUsedAbility) {
      await interaction.reply({
        content: "❌ **You have already used your detection ability.**",
        ephemeral: true,
      });
      return;
    }

    const playerId = interaction.customId.split("_")[1];

    if (!gameState.players.includes(playerId)) {
      await interaction.reply({
        content: "❌ **You cannot reveal this player's role.**",
        ephemeral: true,
      });
      return;
    }

    gameState.detectiveUsedAbility = true;
    gameState.detectiveTarget = playerId;

    //  await interaction.channel.send(
    //    `🔍 **The detective has revealed <@${playerId}>'s role.**`
    //   );

    gameState.detectivePhaseEnded = true;
    saveGameState();
    checkIfNightEnded();
  } catch (error) {
    console.error("Error in handledetectiveDetect:", error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content:
          "❌ **An error occurred while trying to detect. Please try again.**",
        ephemeral: true,
      });
    }
  }
}

async function handledetectiveSkip(interaction) {
  try {
    if (!gameState.gameActive) return;

    if (gameState.detectiveUsedAbility) {
      await interaction.reply({
        content: "❌ **You have already used your detection ability.**",
        ephemeral: true,
      });
      return;
    }

    await interaction.update({
      content:
        "⏩ **You have chosen to skip detection this round. You can detect in a future round.**",
      components: [],
    });

    //  await interaction.channel.send(
    //  `🔍 **The detective decided not to detect this round.**`
    // );

    gameState.detectivePhaseEnded = true;
    saveGameState();
    checkIfNightEnded();
  } catch (error) {
    console.error("Error in handledetectiveSkip:", error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content:
          "❌ **An error occurred while trying to skip. Please try again.**",
        ephemeral: true,
      });
    }
  }
}

function checkIfNightEnded() {
  if (
    gameState.mafiaPhaseEnded &&
    gameState.doctorPhaseEnded &&
    gameState.bodyguardPhaseEnded &&
    gameState.detectivePhaseEnded &&
    gameState.citizenPhaseEnded
  ) {
    gameState.mafiaPhaseEnded = false;
    gameState.doctorPhaseEnded = false;
    gameState.bodyguardPhaseEnded = false;
    gameState.detectivePhaseEnded = false;
    gameState.citizenPhaseEnded = false;
    resolveNightPhase();
  }
}
async function GetPlayerName(playerId) {
  var targetObj = gameState.gameChannel?.guild?.members?.cache.get(playerId);
  if (targetObj == null || targetObj == undefined) {
    targetObj = await client.users.fetch(playerId);
    if (targetObj == null) {
      targetObj = await guild?.members.fetch(playerId);
    }
  }

  return targetObj?.displayName || targetObj?.globalName || "Unknown";
}
function vibeCompare(player1, player2) {
  return (
    vibeCheck(player1) === vibeCheck(player2) ||
    vibeCheck(player1) === 4 ||
    vibeCheck(player2) === 4
  );
}

function vibeCheck(playerId) {
  switch (gameState.playerRoles.get(playerId)) {
    case "doctor":
    case "citizen":
    case "detective":
    case "bodyguard":
      return 1;
    case "mafia":
      return 2;
    case "mayor":
    case "president":
      return 3;
    case "clown":
      return 4;
  }
}

async function resolveNightPhase(channel) {
  try {
    if (!gameState.gameActive) return;
    if (gameState.detectiveTarget != null) {
      const role =
        gameState.playerRoles.get(gameState.detectiveTarget) || "citizen";

      sendPlayerMessage(
        gameState.detective,
        `🔍 **You have chosen to reveal <@${
          gameState.detectiveTarget
        }>'s role. Their role is: ${role.toUpperCase()}.**`
      );
      gameState.detectiveTarget = null;
    }
    for (var [player, action] of gameState.citizenActions) {
      if (
        !(
          action == null ||
          action.target1 == null ||
          action.target2 == null ||
          !gameState.players.includes(action.target1) ||
          !gameState.players.includes(action.target2)
        )
      ) {
        var vibeStatus =
          "These players don't share the same vibes. The energy is terrible.";
        if (vibeCompare(action.target1, action.target2)) {
          vibeStatus =
            "These players have good vibes. They are on the save wavelength";
        }
        var target1Name = await GetPlayerName(action.target1);
        var target2Name = await GetPlayerName(action.target2);
        const embed = new EmbedBuilder()
          .setTitle("📈 ** Vibe Check Results**")
          .setColor("#1E792C")
          .addFields(
            {
              name: "You've checked the similarity of vibes on the following two players",
              value: `${target1Name} and ${target2Name}`,
              inline: true,
            },
            {
              name: "Final Verdict:",
              value: vibeStatus,
            }
          );
        sendPlayerMessage(player, { embeds: embed });
        gameState.citizensUsedAbility =
          gameState.citizensUsedAbility.push(player);
      }
    }
    gameState.citizenActions = null;
    var killedPlayer = gameState.killedPlayer;
    const protectedPlayer = gameState.protectedPlayer;
    var savedPlayer = null;
    if (gameState.shieldedPlayer == killedPlayer) {
      savedPlayer = killedPlayer;
      killedPlayer = gameState.bodyguard;
    }
    if (killedPlayer && killedPlayer !== protectedPlayer) {
      gameState.players = gameState.players.filter(
        (player) => player !== killedPlayer
      );
      var role = gameState.playerRoles.get(killedPlayer);
      role = "citizen";
      if (gameState.mafias.includes(killedPlayer)) {
        role = "mafia";
        gameState.mafias = gameState.mafias.filter(
          (mafia) => mafia !== killedPlayer
        );
      }
      if (killedPlayer === gameState.doctor) {
        gameState.doctor = null;
        role = "doctor";
      }
      if (killedPlayer === gameState.detective) {
        gameState.detective = null;
        role = "detective";
      }
      if (killedPlayer === gameState.bodyguard) {
        gameState.bodyguard = null;
        role = "bodyguard";
      }
      if (killedPlayer === gameState.mayor) {
        gameState.mayor = null;
        role = "mayor";
      }
      if (killedPlayer === gameState.president) {
        gameState.president = null;
        role = "president";
      }
      if (killedPlayer === gameState.clown) {
        gameState.clown = null;
        role = "clown";
        const embed = new EmbedBuilder()
          .setTitle("📊 **The Clown was killed at night **")
          .setColor("#00ff00")
          .addFields({
            name: "As a result, they have lost and are to be forever shunned in clown circles.",
            value: "Shame on them.",
            inline: true,
          })
          .setTimestamp();

        gameState.gameChannel.send({ embeds: [embed] });
      }

      
      const murderMethod = murderMethods.sort(() => Math.random() - 0.5)[0];
      if (savedPlayer != null) {
        sendPlayerMessage(
          savedPlayer,
          "You heard fighting in the night in front of your house. The bodyguard successfully protected you"
        );
      }
      await gameState.gameChannel.send(
        `💀 **<@${killedPlayer}> was killed by the mafia tonight. They were killed ${murderMethod}**`
      );
      await sendPlayerToHell(killedPlayer);
    } else if (killedPlayer && killedPlayer === protectedPlayer) {
      await gameState.gameChannel.send(
        `💉 **The killing failed because <@${protectedPlayer}> was protected by the doctor.**`
      );
    }

    gameState.killedPlayer = null;
    gameState.protectedPlayer = null;

    if (checkWinConditions(channel)) {
      return;
    }

    if (gameState.gameActive) {
      setTimeout(() => startVotePhase(channel), 3000);
    }
  } catch (error) {
    console.error("Error in resolveNightPhase:", error);
    await gameState.gameChannel.send(
      "❌ **An error occurred while ending the night phase.**"
    );
  }
}

function checkWinConditions(channel) {
  try {
    const mafiaCount = gameState.players.filter(
      (player) => gameState.playerRoles.get(player) === "mafia"
    ).length;

    const citizenCount =
      gameState.players.filter((player) => player != gameState.clown).length -
      mafiaCount;

    let winner = null;

    if (mafiaCount === 0) {
      winner = "🎉 **The citizens win!**";
    } else if (
      mafiaCount >= citizenCount &&
      !(gameState.president != null && !gameState.presidentUsedAbility) &&
      gameState.mayor == null
    ) {
      winner = "💀 **The mafia wins!**";
    }

    if (winner) {
      const allPlayersWithRoles = gameState.allPlayers
        .map((playerId) => {
          const role = gameState.playerRoles.get(playerId) || "citizen";
          return `<@${playerId}> - ${role}`;
        })
        .join("\n");

      const allPlayersMentions = gameState.allPlayers
        .map((id) => `<@${id}>`)
        .join(", ");

      const embed = new EmbedBuilder()
        .setTitle("📊 **Game Results**")
        .setColor("#00ff00")
        .addFields(
          { name: "Winner", value: winner, inline: true },
          {
            name: "Number of Players",
            value: `${gameState.allPlayers.length}`,
            inline: true,
          },
          { name: "Survivors", value: getAlivePlayers(), inline: false },
          {
            name: "All Players and Their Roles",
            value: allPlayersWithRoles,
            inline: false,
          }
        )
        .setTimestamp();

      channel.send({ embeds: [embed] });
      if (
        gameState.clown != null &&
        gameState.players.includes(gameState.clown)
      ) {
        const embed = new EmbedBuilder()
          .setTitle("🤡 **The Clown survived the entire game**")
          .setColor("#00ff00")
          .addFields({
            name: "As a result, they have lost and are to be forever shunned in clown circles.",
            value: "Shame on them.",
            inline: true,
          })
          .setTimestamp();

        gameState.gameChannel.send({ embeds: [embed] });
      }
      resetGame();
      return true;
    }

    return false;
  } catch (error) {
    console.error("Error in checkWinConditions:", error);
    return false;
  }
}

function getAlivePlayers() {
  if (gameState.players.length === 0) return "No survivors.";
  return gameState.players.map((id) => `<@${id}>`).join(", ");
}

async function startVotePhase(channel) {
  try {
    if (!gameState.gameActive || gameState.votePhaseActive) return;
    gameState.currentPhase = "day";
    saveGameState();

    gameState.votePhaseActive = true;

    const alivePlayers = [...gameState.players];
    alivePlayers.sort(() => Math.random() - 0.5);
    if (alivePlayers.length <= 2) {
      if (checkWinConditions(channel)) {
        return;
      }
    }
    console.log(JSON.stringify(alivePlayers));
    // Create the voting buttons for players
    const buttons = [];
    for (var i in [...alivePlayers]) {
      var target = alivePlayers[i];
      var targetObj = channel?.guild?.members?.cache.get(target);
      if (targetObj == null || targetObj == undefined) {
        targetObj = await client.users.fetch(target);
        if (targetObj == null) {
          targetObj = await guild?.members.fetch(target);
        }
        console.log(JSON.stringify(targetObj));
      }
      buttons.push(
        new ButtonBuilder()
          .setCustomId(`vote_${target}`)
          .setLabel(
            `${targetObj?.displayName || targetObj?.globalName || "Unknown"}`
          )
          .setStyle(ButtonStyle.Secondary)
      );
    }

    // Create the skip vote button
    const skipButton = new ButtonBuilder()
      .setCustomId("skip_vote")
      .setLabel("Skip Vote")
      .setStyle(ButtonStyle.Secondary);

    // Create the President's button
    const presidentButton = new ButtonBuilder()
      .setCustomId("president_ability")
      .setLabel("Use President Ability")
      .setStyle(ButtonStyle.Primary);

    // Disable the President's button if they've used their ability or if President is not in game
    if (
      gameState.presidentUsedAbility ||
      !gameState.players.includes(gameState.president)
    ) {
      presidentButton.setDisabled(true);
    }

    const votingButtonRows = [];
    for (let i = 0; i < buttons.length; i += 5) {
      votingButtonRows.push(
        new ActionRowBuilder().addComponents(buttons.slice(i, i + 5))
      );
    }
    var controlButtonsRow = null;
    if (gameState.hasPresident) {
      controlButtonsRow = new ActionRowBuilder().addComponents(
        skipButton,
        presidentButton
      );
    } else {
      controlButtonsRow = new ActionRowBuilder().addComponents(skipButton);
    }
    await disableButtonsInChannel(gameState.gameChannel);
    var playersWhoNeedToVote = [...gameState.players];

    for (var [key, value] of gameState.votes) {
      playersWhoNeedToVote = playersWhoNeedToVote.filter((p) => p != key);
    }
    var playerNamesNeedToVote = await Promise.all(
      playersWhoNeedToVote.map(async (p) => {
        var targetObj = gameState.gameChannel?.guild?.members?.cache.get(p);
        if (targetObj == null || targetObj == undefined) {
          targetObj = await client.users.fetch(p);
          if (targetObj == null) {
            targetObj = await guild?.members.fetch(p);
          }
        }
        return targetObj?.displayName || targetObj?.globalName || "Unknown";
      })
    );

    gameState.voteEmbed = new EmbedBuilder()
      .setTitle("🔥🌞🔥 **MURDER ELECTION!** 🔥🌞🔥")
      .setDescription(
        "🗳️ **It's daytime again! Choose who you think is the mafia or choose to skip voting.**"
      )
      .setColor("#FF4500")
      .setThumbnail(client.user.displayAvatarURL())
      .addFields({
        name: "Who still needs to vote:",
        value: `${playerNamesNeedToVote.join(", ")}`,
        inline: true,
      })
      .setFooter({ text: "Join now and enjoy the game!" })
      .setTimestamp();

    gameState.voteMessage = await gameState.gameChannel.send({
      embeds: [gameState.voteEmbed],
      components: [...votingButtonRows, controlButtonsRow],
    });

    setTimeout(() => tallyVotes(channel), config.citizenVoteTime);
  } catch (error) {
    console.error("Error in startVotePhase:", error);
    await channel.send("❌ **An error occurred during the voting phase.**");
  }
}

async function handleVote(interaction) {
  try {
    const playerId = interaction.customId.split("_")[1];

    if (!gameState.players.includes(interaction.user.id)) {
      await interaction.reply({
        content:
          "❌ **You cannot vote because you are not in the game or have been eliminated.**",
        ephemeral: true,
      });
      return;
    }

    if (!gameState.players.includes(playerId)) {
      await interaction.reply({
        content: "❌ **You cannot vote for this player.**",
        ephemeral: true,
      });
      return;
    }

    let voteWeight = 1;

    if (interaction.user.id === gameState.mayor) {
      voteWeight = 2;
      await interaction.reply({
        content: `✅ **Your vote has been registered with double weight as mayor <@${interaction.user.id}>.**`,
        ephemeral: true,
      });
    } else {
      await interaction.reply({
        content: "✅ **Your vote has been registered.**",
        ephemeral: true,
      });
    }

    if (!gameState.voteCounts) {
      gameState.voteCounts = new Map();
    }

    var currentVote = gameState.votes.get(interaction.user.id);
    if (currentVote == undefined) {
      gameState.totalVotes += 1;
    } else if (currentVote.target == "skip") {
      gameState.skipVotes = gameState.skipVotes - voteWeight;
    }
    gameState.votes.set(interaction.user.id, {
      target: playerId,
      weight: voteWeight,
    });

    let voteDisplayCounts = new Map();
    for (const vote of gameState.votes.values()) {
      if (vote.target !== "skip") {
        voteDisplayCounts.set(
          vote.target,
          (voteDisplayCounts.get(vote.target) || 0) + vote.weight
        );
      }
    }
    var playersWhoNeedToVote = [...gameState.players];

    for (var [key, value] of gameState.votes) {
      playersWhoNeedToVote = playersWhoNeedToVote.filter((p) => p != key);
    }
    var playerNamesNeedToVote = await Promise.all(
      playersWhoNeedToVote.map(async (p) => {
        var targetObj = gameState.gameChannel?.guild?.members?.cache.get(p);
        if (targetObj == null || targetObj == undefined) {
          targetObj = await client.users.fetch(p);
          if (targetObj == null) {
            targetObj = await guild?.members.fetch(p);
          }
        }
        return targetObj?.displayName || targetObj?.globalName || "Unknown";
      })
    );
    const updatedEmbed = EmbedBuilder.from(gameState.voteEmbed).setFields({
      name: "Who still needs to vote:",
      value: `${playerNamesNeedToVote}`,
      inline: true,
    });

    const updatedComponents = await Promise.all(
      interaction.message.components.map(async (row) =>
        new ActionRowBuilder().addComponents(
          await Promise.all(
            row.components.map(async (button) => {
              const targetPlayerId = button.customId.split("_")[1];
              if (button.customId === "skip_vote") {
                return ButtonBuilder.from(button).setLabel(`Skip Vote`);
              }
              if (
                gameState.hasPresident &&
                button.customId === "president_ability"
              )
                return button;

              const voteCount = voteDisplayCounts.get(targetPlayerId) || 0;
              var target = targetPlayerId;
              var targetObj =
                gameState.gameChannel?.guild?.members?.cache.get(target);
              if (targetObj == null || targetObj == undefined) {
                targetObj = await client.users.fetch(target);
                if (targetObj == null) {
                  targetObj = await guild?.members.fetch(target);
                }
              }
              return ButtonBuilder.from(button).setLabel(
                `${
                  targetObj?.displayName || targetObj?.globalName || "Unknown"
                } `
              );
            })
          )
        )
      )
    );

    await interaction.message.edit({
      embeds: [updatedEmbed],
      components: updatedComponents,
    });

    await checkIfAllVotedOrTimeout(interaction.channel);
  } catch (error) {
    console.error("Error in handleVote:", error);
    if (!interaction.replied) {
      await interaction.reply({
        content: "❌ **An error occurred while voting. Please try again.**",
        ephemeral: true,
      });
    }
  }
}

async function handleSkipVote(interaction) {
  try {
    if (!gameState.players.includes(interaction.user.id)) {
      await interaction.reply({
        content:
          "❌ **You cannot vote because you are not in the game or have been eliminated.**",
        ephemeral: true,
      });
      return;
    }

    let voteWeight = 1;

    if (interaction.user.id === gameState.mayor) {
      voteWeight = 2;
      await interaction.reply({
        content: `✅ **Your skip vote has been registered with double weight as mayor <@${interaction.user.id}>.**`,
        ephemeral: true,
      });
    } else {
      await interaction.reply({
        content: "✅ **Your skip vote has been registered.**",
        ephemeral: true,
      });
    }

    gameState.votes.set(interaction.user.id, {
      target: "skip",
      weight: voteWeight,
    });
    gameState.skipVotes = 0;
    gameState.totalVotes += 1;

    for (var [key, value] of gameState.votes) {
      if (value.target == "skip")
        gameState.skipVotes += gameState.mayor == key ? 2 : 1;
    }
    let voteDisplayCounts = new Map();
    for (const vote of gameState.votes.values()) {
      if (vote.target !== "skip") {
        voteDisplayCounts.set(
          vote.target,
          (voteDisplayCounts.get(vote.target) || 0) + vote.weight
        );
      }
    }
    var playersWhoNeedToVote = [...gameState.players];

    for (var [key, value] of gameState.votes) {
      playersWhoNeedToVote = playersWhoNeedToVote.filter((p) => p != key);
    }
    var playerNamesNeedToVote = await Promise.all(
      playersWhoNeedToVote.map(async (p) => {
        var targetObj = gameState.gameChannel?.guild?.members?.cache.get(p);
        if (targetObj == null || targetObj == undefined) {
          targetObj = await client.users.fetch(p);
          if (targetObj == null) {
            targetObj = await guild?.members.fetch(p);
          }
        }
        return targetObj?.displayName || targetObj?.globalName || "Unknown";
      })
    );
    const updatedEmbed = EmbedBuilder.from(gameState.voteEmbed).setFields({
      name: "Who still needs to vote:",
      value: `${playerNamesNeedToVote}`,
      inline: true,
    });
    const updatedComponents = await Promise.all(
      interaction.message.components.map(async (row) =>
        new ActionRowBuilder().addComponents(
          await Promise.all(
            row.components.map(async (button) => {
              const targetPlayerId = button.customId.split("_")[1];
              if (button.customId === "skip_vote") {
                return ButtonBuilder.from(button).setLabel(`Skip Vote `);
              }
              if (
                gameState.hasPresident &&
                button.customId === "president_ability"
              )
                return button;

              const voteCount = voteDisplayCounts.get(targetPlayerId) || 0;
              var target = targetPlayerId;
              var targetObj =
                gameState.gameChannel?.guild?.members?.cache.get(target);
              if (targetObj == null || targetObj == undefined) {
                targetObj = await client.users.fetch(target);
                if (targetObj == null) {
                  targetObj = await guild?.members.fetch(target);
                }
              }
              return ButtonBuilder.from(button).setLabel(
                `${
                  targetObj?.displayName || targetObj?.globalName || "Unknown"
                }`
              );
            })
          )
        )
      )
    );

    await interaction.message.edit({
      embeds: [updatedEmbed],
      components: updatedComponents,
    });

    await checkIfAllVotedOrTimeout(interaction.channel);
  } catch (error) {
    console.error("Error in handleSkipVote:", error);
    if (!interaction.replied) {
      await interaction.reply({
        content:
          "❌ **An error occurred while trying to skip. Please try again.**",
        ephemeral: true,
      });
    }
  }
}

async function handlePresidentAbility(interaction) {
  try {
    if (!gameState.gameActive || !gameState.votePhaseActive) {
      await interaction.reply({
        content: "❌ **You cannot use this ability now.**",
        ephemeral: true,
      });
      return;
    }

    if (interaction.user.id !== gameState.president) {
      await interaction.reply({
        content: "❌ **This ability is for the president only.**",
        ephemeral: true,
      });
      return;
    }

    if (gameState.presidentUsedAbility) {
      await interaction.reply({
        content: "❌ **You have already used your ability.**",
        ephemeral: true,
      });
      return;
    }

    // Mark that the President has used their ability
    gameState.presidentUsedAbility = true;

    // Create buttons for the President to select a player
    const alivePlayers = gameState.players.filter(
      (player) => player !== gameState.president
    );
    const buttons = [];
    for (var i in alivePlayers) {
      var target = alivePlayers[i];
      var targetObj = gameState.gameChannel?.guild?.members?.cache.get(target);
      if (targetObj == null || targetObj == undefined) {
        targetObj = await client.users.fetch(target);
        if (targetObj == null) {
          targetObj = await guild?.members.fetch(target);
        }
      }
      buttons.push(
        new ButtonBuilder()
          .setCustomId(`president_select_${target}`)
          .setLabel(
            `${targetObj?.displayName || targetObj?.globalName || "Unknown"}`
          )
          .setStyle(ButtonStyle.Danger)
      );
    }

    const rows = createButtonRows(buttons);

    await interaction.reply({
      content: "👑 **Choose the player you want to redirect all votes to.**",
      components: rows,
      ephemeral: true,
    });
  } catch (error) {
    console.error("Error in handlePresidentAbility:", error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content:
          "❌ **An error occurred while using the ability. Please try again.**",
        ephemeral: true,
      });
    }
  }
}

async function handlePresidentSelection(interaction) {
  try {
    if (!gameState.gameActive || !gameState.votePhaseActive) {
      await interaction.reply({
        content: "❌ **You cannot use this ability now.**",
        ephemeral: true,
      });
      return;
    }

    if (interaction.user.id !== gameState.president) {
      await interaction.reply({
        content: "❌ **This ability is for the president only.**",
        ephemeral: true,
      });
      return;
    }

    const selectedPlayerId = interaction.customId.split("_")[2];

    if (!gameState.players.includes(selectedPlayerId)) {
      await interaction.reply({
        content: "❌ **You cannot choose this player.**",
        ephemeral: true,
      });
      return;
    }

    gameState.votes.clear();
    gameState.totalVotes = 0;
    gameState.skipVotes = 0;

    for (const voterId of gameState.players) {
      let voteWeight = 1;

      if (voterId === gameState.mayor) {
        voteWeight = 2;
      }

      gameState.votes.set(voterId, {
        target: selectedPlayerId,
        weight: voteWeight,
      });
    }

    gameState.totalVotes = gameState.players.length;

    await interaction.update({
      content: `👑 **You have chosen to redirect all votes to <@${selectedPlayerId}>.**`,
      components: [],
    });

    await interaction.channel.send(
      `👑 **The president used their ability and redirected all votes to <@${selectedPlayerId}>!**`
    );

    if (gameState.voteTimeout) {
      clearTimeout(gameState.voteTimeout);
      gameState.voteTimeout = null;
    }

    gameState.votePhaseActive = false;
    await tallyVotes(interaction.channel);
  } catch (error) {
    console.error("Error in handlePresidentSelection:", error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content:
          "❌ **An error occurred while choosing the player. Please try again.**",
        ephemeral: true,
      });
    }
  }
}

async function checkIfAllVotedOrTimeout(channel) {
  try {
    const remainingPlayers = gameState.players.length;
    if (gameState.votes.size >= remainingPlayers && gameState.votePhaseActive) {
      gameState.votePhaseActive = false;
      if (gameState.voteTimeout) {
        clearTimeout(gameState.voteTimeout);
        gameState.voteTimeout = null;
      }
      await tallyVotes(channel);
    }
  } catch (error) {
    console.error("Error in checkIfAllVotedOrTimeout:", error);
  }
}

async function tallyVotes(channel) {
  try {
    if (!gameState.gameActive) return;

    await disableButtonsInChannel(channel);

    if (gameState.votes.size === 0) {
      await channel.send("⚠️ **No one voted. The round will be skipped.**");
      proceedToNextPhase(channel);
      return;
    }

    const voteCounts = {};
    for (const vote of gameState.votes.values()) {
      voteCounts[vote.target] = (voteCounts[vote.target] || 0) + vote.weight;
    }

    const maxVotes = Math.max(...Object.values(voteCounts));
    const playersWithMaxVotes = Object.keys(voteCounts).filter(
      (player) => voteCounts[player] === maxVotes
    );

    if (
      playersWithMaxVotes.includes("skip") &&
      playersWithMaxVotes.length === 1
    ) {
      await channel.send(
        "🎲 **The vote was to skip the round. No player will be eliminated.**"
      );
    } else if (playersWithMaxVotes.length === 1) {
      const expelledPlayer = playersWithMaxVotes[0];
      var whoVotedForThem = [];
      for (var [key, value] of gameState.votes) {
        if (value.target == expelledPlayer) {
          var targetObj = gameState.gameChannel?.guild?.members?.cache.get(key);
          if (targetObj == null || targetObj == undefined) {
            targetObj = await client.users.fetch(target);
            if (targetObj == null) {
              targetObj = await guild?.members.fetch(target);
            }
          }
          whoVotedForThem.push(
            targetObj?.displayName || targetObj?.globalName || "Unknown"
          );
        }
      }

      gameState.players = gameState.players.filter(
        (player) => player !== expelledPlayer
      );
      var alignmentNotification =
        "They also were a completely innocent member of the town, oops!";
      const role = gameState.playerRoles.get(expelledPlayer);
      if (role === "mafia") {
        alignmentNotification =
          "They were an evil mafia and the town is a safer place now.";

        gameState.mafias = gameState.mafias.filter(
          (mafia) => mafia !== expelledPlayer
        );
      }
      if (expelledPlayer === gameState.doctor) {
        gameState.doctor = null;
      }
      if (expelledPlayer === gameState.detective) {
        gameState.detective = null;
      }
      if (expelledPlayer === gameState.bodyguard) {
        gameState.bodyguard = null;
      }
      if (expelledPlayer === gameState.mayor) {
        gameState.mayor = null;
      }
      if (expelledPlayer === gameState.president) {
        gameState.president = null;
      }
      if (expelledPlayer === gameState.clown) {
        alignmentNotification = "They were the clown.";

        const embed = new EmbedBuilder()
          .setTitle(
            "🤡🤡🤡🤡🤡🤡🤡🤡🤡 **THE TOWN FELL FOR THE CLOWN **🤡🤡🤡🤡🤡🤡🤡🤡🤡🤡"
          )
          .setColor("#00ff00")
          .addFields({
            name: "You should probably feel a little ashamed, you all just got clowned on",
            value: "The clown is the game's first winner! Bravo!.",
            inline: true,
          })
          .setTimestamp();

        gameState.gameChannel.send({ embeds: [embed] });
      }
      
      const wayToDie = waysToDie.sort(() => Math.random() - 0.5)[0];

      await channel.send(
        `🚫 **<@${expelledPlayer}> was voted out and ${wayToDie} ${alignmentNotification}**`
      );
      await channel.send(`😈 ** The following players voted for them ** 👿`);
      await channel.send(` ${whoVotedForThem.join(", ")}`);
      await sendPlayerToHell(expelledPlayer);
    } else {
      await channel.send(
        "⚖️ **There was a tie in votes. No player will be eliminated.**"
      );
    }

    gameState.votes.clear();
    gameState.skipVotes = 0;
    gameState.totalVotes = 0;
    gameState.votePhaseActive = false;
    gameState.voteCounts = null;

    if (checkWinConditions(channel)) {
      return;
    }

    proceedToNextPhase(channel);
  } catch (error) {
    console.error("Error in tallyVotes:", error);
    await channel.send("An error occurred while counting votes.");
  }
}

async function disableButtonsInChannel(channel) {
  try {
    const messages = await channel.messages.fetch({ limit: 10 });
    for (const message of messages.values()) {
      if (message.components.length > 0) {
        await disableButtons(message);
      }
    }
  } catch (error) {
    console.error("Error in disableButtonsInChannel:", error);
  }
}

function proceedToNextPhase(channel) {
  if (!gameState.gameActive) return;

  const timeout = setTimeout(() => startNightPhase(channel), 3000);
  gameTimeouts.push(timeout);
}

function createButtonRows(buttons) {
  const rows = [];
  for (let i = 0; i < buttons.length; i += 5) {
    rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 5)));
  }
  return rows;
}

client.login(config.token);
