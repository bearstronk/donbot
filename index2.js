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
} = require("discord.js");

const config = require("./config.js");

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
  playerRoles: new Map(),
  mafias: [],
  doctor: null,
  detector: null,
  bodyguard: null,
  mayor: null,
  president: null,
  presidentUsedAbility: false,
  gameActive: false,
  protectedPlayer: null,
  shieldedPlayer: null,
  shieldedPlayerRound: null,
  killedPlayer: null,
  votes: new Map(),
  skipVotes: 0,
  totalVotes: 0,
  mafiaActions: new Map(),
  doctorActionTaken: false,
  doctorPhaseEnded: false,
  detectorUsedAbility: false,
  bodyguardUsedAbility: false,
  bodyguardPhaseEnded: false,
  gameMessage: null,
  mafiaMessages: new Map(),
  mafiaInteractions: new Map(),
  doctorInteraction: null,
  detectorInteraction: null,
  bodyguardInteraction: null,
  mayorInteraction: null,
  votePhaseActive: false,
  mafiaPhaseEnded: false,
  mafiaTimeout: null,
  currentRound: 0,
  mafiaThread: null,
};
const interactions = new Map();
let gameInterval = null;
let gameTimeouts = [];

client.on("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
  console.log(`Code by Wick Studio`);
  console.log(`discord.gg/wicks`);
  resetGame();
});

client.on("messageCreate", async (message) => {
  try {
    if (message.author.bot) return;
    if (message.content === "-mafia") {
      const member = message.member;

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

      await startGame(message);
    }
  } catch (error) {
    console.error("Error in messageCreate:", error);
    await message.channel.send(
      "❌ **An unexpected error occurred while processing the message.**"
    );
  }
});

async function startGame(message) {
  try {
    resetGame();

    gameState.gameActive = true;
    gameState.allPlayers = [];

    const embed = new EmbedBuilder()
      .setTitle("🔥 **Mafia Game** 🔥")
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

        if (timeLeft <= 0) {
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
                gameState.gameMessage = null;
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
    } else if (customId.startsWith("kill_")) {
      await handleMafiaKill(interaction);
    } else if (customId.startsWith("protect_")) {
      await handleDoctorProtect(interaction);
    } else if (customId.startsWith("detect_")) {
      await handleDetectorDetect(interaction);
    } else if (customId === "skip_detect") {
      await handleDetectorSkip(interaction);
    } else if (customId.startsWith("shield_")) {
      await handleBodyguardShield(interaction);
    } else if (customId === "skip_shield") {
      await handleBodyguardSkip(interaction);
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

async function assignRoles(channel) {
  try {
    if (!gameState.gameActive) return;

    gameState.allPlayers = [...gameState.players];

    const shuffledPlayers = gameState.players.sort(() => Math.random() - 0.5);

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
    if (shuffledPlayers.length >= 15) {
      mafiaCount = 3;
    }
    if (shuffledPlayers.length >= 23) {
      mafiaCount = 4;
    }

    gameState.mafias = shuffledPlayers.slice(0, mafiaCount);
    gameState.doctor = shuffledPlayers[mafiaCount];
    gameState.detector = shuffledPlayers[mafiaCount + 1];
    gameState.bodyguard = shuffledPlayers[mafiaCount + 2];
    gameState.mayor = shuffledPlayers[mafiaCount + 3];
    gameState.president = shuffledPlayers[mafiaCount + 4];

    shuffledPlayers.slice(mafiaCount + 5).forEach((player) => {
      gameState.playerRoles.set(player, "citizen");
    });

    for (const mafia of gameState.mafias) {
      gameState.playerRoles.set(mafia, "mafia");
    }
    gameState.playerRoles.set(gameState.doctor, "doctor");
    gameState.playerRoles.set(gameState.detector, "detector");
    gameState.playerRoles.set(gameState.bodyguard, "bodyguard");
    gameState.playerRoles.set(gameState.mayor, "mayor");
    gameState.playerRoles.set(gameState.president, "president");

    for (const playerId of gameState.players) {
      const role = gameState.playerRoles.get(playerId);
      const interaction = interactions.get(playerId);

      if (interaction) {
        if (!interaction.replied) {
          await interaction.deferReply({ ephemeral: true }).catch((error) => {
            console.error(
              `Error deferring interaction for player ${playerId}:`,
              error
            );
          });
        }
        await interaction
          .followUp({
            ephemeral: true,
            content: `🎭 **Your role is:** **${role.toUpperCase()}**.`,
          })
          .catch((error) => {
            console.error(`Error sending role to player ${playerId}:`, error);
          });
      } else {
        console.error(`Interaction for player ${playerId} not found.`);
      }
    }

    if (gameState.mafias.length >= 2) {
      try {
        const mafiaThread = await channel.threads.create({
          name: `Mafia Chat - Game ${gameState.currentRound}`,
          autoArchiveDuration: 60,
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
          value: `${gameState.players.length - mafiaCount - 4}`,
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

    const timeout = setTimeout(() => startMafiaPhase(channel), 5000);
    gameTimeouts.push(timeout);
  } catch (error) {
    console.error("Error in assignRoles:", error);
    await channel.send("❌ **An error occurred while assigning roles.**");
  }
}

function resetGame() {
  if (gameState.gameMessage) {
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

  gameState = {
    players: [],
    allPlayers: [],
    playerRoles: new Map(),
    mafias: [],
    doctor: null,
    detector: null,
    bodyguard: null,
    mayor: null,
    gameActive: false,
    protectedPlayer: null,
    shieldedPlayer: null,
    shieldedPlayerRound: null,
    killedPlayer: null,
    votes: new Map(),
    skipVotes: 0,
    totalVotes: 0,
    mafiaActions: new Map(),
    doctorActionTaken: false,
    doctorPhaseEnded: false,
    detectorUsedAbility: false,
    bodyguardUsedAbility: false,
    bodyguardPhaseEnded: false,
    gameMessage: null,
    mafiaMessages: new Map(),
    mafiaInteractions: new Map(),
    doctorInteraction: null,
    detectorInteraction: null,
    bodyguardInteraction: null,
    mayorInteraction: null,
    votePhaseActive: false,
    mafiaPhaseEnded: false,
    mafiaTimeout: null,
    currentRound: 0,
    mafiaThread: null,
  };

  interactions.clear();

  if (gameInterval) {
    clearInterval(gameInterval);
    gameInterval = null;
  }

  gameTimeouts.forEach((timeout) => clearTimeout(timeout));
  gameTimeouts = [];

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

async function startMafiaPhase(channel) {
  try {
    if (!gameState.gameActive) return;

    gameState.currentRound += 1;

    if (
      gameState.shieldedPlayerRound !== null &&
      gameState.currentRound > gameState.shieldedPlayerRound
    ) {
      gameState.shieldedPlayer = null;
      gameState.shieldedPlayerRound = null;
    }

    gameState.mafiaActions.clear();
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
    if (
      gameState.shieldedPlayer &&
      gameState.players.includes(gameState.shieldedPlayer)
    ) {
      availableTargets = availableTargets.filter(
        (player) => player !== gameState.shieldedPlayer
      );
    }

    if (availableTargets.length === 0) {
      await channel.send("❌ **There are no players the mafia can kill.**");
      resolveMafiaActions(channel);
      return;
    }

    await channel.send("💀 **Mafia, it is your turn to choose your victim.**");

    const buttons = availableTargets.map((player) =>
      new ButtonBuilder()
        .setCustomId(`kill_${player}`)
        .setLabel(
          `${channel.guild.members.cache.get(player)?.displayName || "Unknown"}`
        )
        .setStyle(ButtonStyle.Danger)
    );

    const rows = createButtonRows(buttons);

    for (const mafiaId of gameState.mafias) {
      const mafiaInteraction = interactions.get(mafiaId);

      if (mafiaInteraction) {
        if (mafiaInteraction.replied || mafiaInteraction.deferred) {
          const message = await mafiaInteraction.followUp({
            content:
              "💀 **You have been chosen as mafia. You must choose a player to kill. If you choose different players, the victim will be chosen randomly.**",
            components: rows,
            ephemeral: true,
          });
          gameState.mafiaMessages.set(mafiaId, message.id);
          gameState.mafiaInteractions.set(mafiaId, mafiaInteraction);
        } else {
          await mafiaInteraction.deferReply({ ephemeral: true });
          const message = await mafiaInteraction.editReply({
            content:
              "💀 **You have been chosen as mafia. You must choose a player to kill. If you choose different players, the victim will be chosen randomly.**",
            components: rows,
          });
          gameState.mafiaMessages.set(mafiaId, message.id);
          gameState.mafiaInteractions.set(mafiaId, mafiaInteraction);
        }
      } else {
        console.error(`Mafia interaction for player ${mafiaId} not found.`);
      }
    }

    gameState.mafiaTimeout = setTimeout(async () => {
      await handleMafiaTimeout(channel);
    }, config.mafiaKillTime);

    gameTimeouts.push(gameState.mafiaTimeout);
  } catch (error) {
    console.error("Error in startMafiaPhase:", error);
    await channel.send("❌ **An error occurred during the mafia phase.**");
  }
}

async function handleMafiaTimeout(channel) {
  try {
    if (!gameState.gameActive || gameState.mafiaPhaseEnded) return;

    for (const mafiaId of gameState.mafias.slice()) {
      if (!gameState.mafiaActions.has(mafiaId)) {
        await channel.send(
          `🕒 **Mafia <@${mafiaId}> did not act in time and has been eliminated from the game.**`
        );
        gameState.players = gameState.players.filter(
          (player) => player !== mafiaId
        );
        gameState.mafias = gameState.mafias.filter(
          (mafia) => mafia !== mafiaId
        );

        const mafiaInteraction = gameState.mafiaInteractions.get(mafiaId);
        if (mafiaInteraction) {
          try {
            await mafiaInteraction.editReply({
              content:
                "❌ **You did not choose anyone to kill and have been eliminated from the game.**",
              components: [],
            });
          } catch (err) {
            console.error("Error editing Mafia message:", err);
          }
        }
      }
    }

    if (gameState.mafias.length === 0) {
      await channel.send(
        "🎉 **The citizens win! All mafia have been eliminated.**"
      );
      gameState.gameActive = false;
      checkWinConditions(channel);
      return;
    }

    await resolveMafiaActions(channel);
  } catch (error) {
    console.error("Error in handleMafiaTimeout:", error);
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

      await interaction.update({
        content: `✅ **You have chosen to kill <@${playerId}>. Wait for the other mafia to choose.**`,
        components: [],
      });

      if (gameState.mafiaActions.size === gameState.mafias.length) {
        if (gameState.mafiaTimeout) {
          clearTimeout(gameState.mafiaTimeout);
          gameState.mafiaTimeout = null;
        }
        await resolveMafiaActions(interaction.channel);
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
      await channel.send(
        "🗡️ **The mafia did not choose any victim. Moving to the next phase.**"
      );
      await channel.send("💀 **The mafia did not kill anyone tonight.**");
      const timeout = setTimeout(() => startDoctorPhase(channel), 5000);
      gameTimeouts.push(timeout);
      return;
    }

    let targetToKill;
    if (selectedTargets.every((val, i, arr) => val === arr[0])) {
      targetToKill = selectedTargets[0];
    } else {
      targetToKill =
        selectedTargets[Math.floor(Math.random() * selectedTargets.length)];
      await channel.send(
        `🗡️ **The mafia chose different targets. The victim will be chosen randomly.**`
      );
    }

    gameState.killedPlayer = targetToKill;

    for (const mafiaId of gameState.mafias) {
      const mafiaInteraction = gameState.mafiaInteractions.get(mafiaId);
      if (mafiaInteraction) {
        try {
          await mafiaInteraction.followUp({
            content: `🗡️ **The final victim is <@${targetToKill}>.**`,
            ephemeral: true,
          });
        } catch (err) {
          console.error("Error notifying Mafia:", err);
        }
      }
    }

    await channel.send("💀 **The mafia have finished choosing.**");

    await channel.send(
      `🗡️ **The mafia have chosen a victim! Now it is the doctor's turn to protect a player.**`
    );

    const timeout = setTimeout(() => startDoctorPhase(channel), 5000);
    gameTimeouts.push(timeout);
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

      if (gameState.doctorTimeout) {
        clearTimeout(gameState.doctorTimeout);
        gameState.doctorTimeout = null;
      }

      await interaction.update({
        content: `✅ **You have chosen to protect <@${playerId}>.**`,
        components: [],
      });

      await interaction.channel.send(
        "💉 **The doctor has protected a player.**"
      );

      gameState.doctorPhaseEnded = true;
      startBodyguardPhase(interaction.channel);
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
      await channel.send(
        "💉 **The doctor is not present. Moving to the next phase.**"
      );
      startBodyguardPhase(channel);
      return;
    }

    await channel.send("💉 **Doctor, it is your turn to protect a player.**");

    const buttons = alivePlayers.map((player) =>
      new ButtonBuilder()
        .setCustomId(`protect_${player}`)
        .setLabel(
          `${channel.guild.members.cache.get(player)?.displayName || "Unknown"}`
        )
        .setStyle(ButtonStyle.Primary)
    );

    const rows = createButtonRows(buttons);
    const doctorInteraction = interactions.get(gameState.doctor);

    if (doctorInteraction) {
      if (doctorInteraction.replied || doctorInteraction.deferred) {
        const message = await doctorInteraction.followUp({
          content:
            "💉 **You have been chosen as the doctor. You can protect any player, including yourself, from being killed.**",
          components: rows,
          ephemeral: true,
        });
        gameState.doctorInteraction = doctorInteraction;
      } else {
        await doctorInteraction.deferReply({ ephemeral: true });
        await doctorInteraction.editReply({
          content:
            "💉 **You have been chosen as the doctor. You can protect any player, including yourself, from being killed.**",
          components: rows,
        });
        gameState.doctorInteraction = doctorInteraction;
      }
    } else {
      console.error("Doctor interaction not found.");
    }

    gameState.doctorTimeout = setTimeout(async () => {
      if (
        !gameState.doctorActionTaken &&
        gameState.gameActive &&
        !gameState.doctorPhaseEnded
      ) {
        await channel.send(
          `💉 **The doctor did not act. The doctor <@${gameState.doctor}> will be eliminated from the game.**`
        );
        if (gameState.doctorInteraction) {
          try {
            await gameState.doctorInteraction.editReply({
              content: "❌ **You did not choose anyone to protect.**",
              components: [],
            });
          } catch (err) {
            console.error("Error editing Doctor message:", err);
          }
        }
        gameState.players = gameState.players.filter(
          (player) => player !== gameState.doctor
        );
        gameState.doctor = null;
        gameState.doctorPhaseEnded = true;
        startBodyguardPhase(channel);
      }
    }, config.docActionTime);

    gameTimeouts.push(gameState.doctorTimeout);
  } catch (error) {
    console.error("Error in startDoctorPhase:", error);
    await channel.send("❌ **An error occurred during the doctor phase.**");
  }
}

async function startBodyguardPhase(channel) {
  try {
    if (!gameState.gameActive) return;

    if (
      gameState.bodyguardUsedAbility ||
      !gameState.players.includes(gameState.bodyguard)
    ) {
      if (gameState.bodyguardUsedAbility) {
        await channel.send(
          "🛡️ **The bodyguard has already used their ability so skipping.**"
        );
      } else {
        await channel.send("🛡️ **The bodyguard is not present so skipping.**");
      }
      startDetectorPhase(channel);
      return;
    }

    gameState.bodyguardPhaseEnded = false;

    await channel.send("🛡️ **Bodyguard, it is your turn to give a shield.**");

    await channel.send(
      "🛡️ **You can give a shield to one player once in the game.**"
    );

    const alivePlayers = gameState.players;

    const buttons = alivePlayers.map((player) =>
      new ButtonBuilder()
        .setCustomId(`shield_${player}`)
        .setLabel(
          `${channel.guild.members.cache.get(player)?.displayName || "Unknown"}`
        )
        .setStyle(ButtonStyle.Primary)
    );

    const skipButton = new ButtonBuilder()
      .setCustomId("skip_shield")
      .setLabel("Skip Giving Shield")
      .setStyle(ButtonStyle.Secondary);

    const rows = createButtonRows([...buttons, skipButton]);

    const bodyguardInteraction = interactions.get(gameState.bodyguard);

    if (bodyguardInteraction) {
      if (bodyguardInteraction.replied || bodyguardInteraction.deferred) {
        const message = await bodyguardInteraction.followUp({
          content:
            "🛡️ **You have been chosen as the bodyguard. You can give a shield to one player once in the game.**",
          components: rows,
          ephemeral: true,
        });
        gameState.bodyguardInteraction = {
          id: message.id,
          interaction: bodyguardInteraction,
        };
      } else {
        await bodyguardInteraction.deferReply({ ephemeral: true });
        const message = await bodyguardInteraction.editReply({
          content:
            "🛡️ **You have been chosen as the bodyguard. You can give a shield to one player once in the game.**",
          components: rows,
        });
        gameState.bodyguardInteraction = {
          id: message.id,
          interaction: bodyguardInteraction,
        };
      }
    } else {
      console.error("Bodyguard interaction not found.");
    }

    const timeout = setTimeout(async () => {
      if (gameState.gameActive && !gameState.bodyguardPhaseEnded) {
        if (!gameState.bodyguardUsedAbility) {
          await bodyguardInteraction.followUp({
            content:
              "❌ **Time is up and you did not make a decision. You can give the shield in a future round.**",
            ephemeral: true,
          });
        }
        gameState.bodyguardPhaseEnded = true;
        startDetectorPhase(channel);
      }
    }, config.bodyguardPhaseTime);

    gameTimeouts.push(timeout);
  } catch (error) {
    console.error("Error in startBodyguardPhase:", error);
    await channel.send("❌ **An error occurred during the bodyguard phase.**");
  }
}

async function handleBodyguardShield(interaction) {
  try {
    if (!gameState.gameActive || gameState.bodyguardPhaseEnded) return;

    if (gameState.bodyguardUsedAbility) {
      await interaction.reply({
        content: "❌ **You have already used your shield ability.**",
        ephemeral: true,
      });
      return;
    }

    const playerId = interaction.customId.split("_")[1];

    if (!gameState.players.includes(playerId)) {
      await interaction.reply({
        content: "❌ **You cannot give a shield to this player.**",
        ephemeral: true,
      });
      return;
    }

    gameState.bodyguardUsedAbility = true;
    gameState.shieldedPlayer = playerId;
    gameState.shieldedPlayerRound = gameState.currentRound + 1;

    await interaction.update({
      content: `✅ **You have chosen to give a shield to <@${playerId}>. They will be protected in the next round.**`,
      components: [],
    });

    await interaction.channel.send(
      `🛡️ **The bodyguard has given a shield to <@${playerId}>.**`
    );

    gameState.bodyguardPhaseEnded = true;
    startDetectorPhase(interaction.channel);
  } catch (error) {
    console.error("Error in handleBodyguardShield:", error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content:
          "❌ **An error occurred while trying to give a shield. Please try again.**",
        ephemeral: true,
      });
    }
  }
}

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

    await interaction.channel.send(
      `🛡️ **The bodyguard decided not to give a shield this round.**`
    );

    gameState.bodyguardPhaseEnded = true;
    startDetectorPhase(interaction.channel);
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
}

async function startDetectorPhase(channel) {
  try {
    if (!gameState.gameActive) return;

    if (
      gameState.detectorUsedAbility ||
      !gameState.players.includes(gameState.detector)
    ) {
      if (gameState.detectorUsedAbility) {
        await channel.send(
          "🕵️ **The detective has already used their ability so skipping.**"
        );
      } else {
        await channel.send("🕵️ **The detective is not present so skipping.**");
      }
      resolveNightPhase(channel);
      return;
    }

    await channel.send(
      "🕵️ **Detective, it is your turn to reveal a player's role.**"
    );

    const alivePlayers = gameState.players.filter(
      (player) => player !== gameState.detector
    );

    const buttons = alivePlayers.map((player) =>
      new ButtonBuilder()
        .setCustomId(`detect_${player}`)
        .setLabel(
          `${channel.guild.members.cache.get(player)?.displayName || "Unknown"}`
        )
        .setStyle(ButtonStyle.Primary)
    );

    const skipButton = new ButtonBuilder()
      .setCustomId("skip_detect")
      .setLabel("Skip Detection")
      .setStyle(ButtonStyle.Secondary);

    const rows = createButtonRows([...buttons, skipButton]);

    const detectorInteraction = interactions.get(gameState.detector);

    if (detectorInteraction) {
      if (detectorInteraction.replied || detectorInteraction.deferred) {
        const message = await detectorInteraction.followUp({
          content:
            "🕵️ **You have been chosen as the detective. You can reveal a player's role once in the game.**",
          components: rows,
          ephemeral: true,
        });
        gameState.detectorInteraction = {
          id: message.id,
          interaction: detectorInteraction,
        };
      } else {
        await detectorInteraction.deferReply({ ephemeral: true });
        const message = await detectorInteraction.editReply({
          content:
            "🕵️ **You have been chosen as the detective. You can reveal a player's role once in the game.**",
          components: rows,
        });
        gameState.detectorInteraction = {
          id: message.id,
          interaction: detectorInteraction,
        };
      }
    } else {
      console.error("Detector interaction not found.");
    }

    const timeout = setTimeout(async () => {
      if (gameState.gameActive) {
        if (!gameState.detectorUsedAbility) {
          await detectorInteraction.followUp({
            content:
              "❌ **Time is up and you did not make a decision. You can detect in a future round.**",
            ephemeral: true,
          });
        }
        resolveNightPhase(channel);
      }
    }, config.detectorPhaseTime);

    gameTimeouts.push(timeout);
  } catch (error) {
    console.error("Error in startDetectorPhase:", error);
    await channel.send("❌ **An error occurred during the detective phase.**");
  }
}

async function handleDetectorDetect(interaction) {
  try {
    if (!gameState.gameActive) return;

    if (gameState.detectorUsedAbility) {
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

    gameState.detectorUsedAbility = true;

    const role = gameState.playerRoles.get(playerId) || "citizen";

    await interaction.update({
      content: `🔍 **You have chosen to reveal <@${playerId}>'s role. Their role is: ${role.toUpperCase()}.**`,
      components: [],
    });

    await interaction.channel.send(
      `🔍 **The detective has revealed <@${playerId}>'s role.**`
    );

    const timeout = setTimeout(
      () => resolveNightPhase(interaction.channel),
      5000
    );
    gameTimeouts.push(timeout);
  } catch (error) {
    console.error("Error in handleDetectorDetect:", error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content:
          "❌ **An error occurred while trying to detect. Please try again.**",
        ephemeral: true,
      });
    }
  }
}

async function handleDetectorSkip(interaction) {
  try {
    if (!gameState.gameActive) return;

    if (gameState.detectorUsedAbility) {
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

    await interaction.channel.send(
      `🔍 **The detective decided not to detect this round.**`
    );

    const timeout = setTimeout(
      () => resolveNightPhase(interaction.channel),
      5000
    );
    gameTimeouts.push(timeout);
  } catch (error) {
    console.error("Error in handleDetectorSkip:", error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content:
          "❌ **An error occurred while trying to skip. Please try again.**",
        ephemeral: true,
      });
    }
  }
}

async function resolveNightPhase(channel) {
  try {
    if (!gameState.gameActive) return;

    const killedPlayer = gameState.killedPlayer;
    const protectedPlayer = gameState.protectedPlayer;

    if (killedPlayer && killedPlayer !== protectedPlayer) {
      gameState.players = gameState.players.filter(
        (player) => player !== killedPlayer
      );
      const role = gameState.playerRoles.get(killedPlayer);
      if (role === "mafia") {
        gameState.mafias = gameState.mafias.filter(
          (mafia) => mafia !== killedPlayer
        );
      }
      if (killedPlayer === gameState.doctor) {
        gameState.doctor = null;
      }
      if (killedPlayer === gameState.detector) {
        gameState.detector = null;
      }
      if (killedPlayer === gameState.bodyguard) {
        gameState.bodyguard = null;
      }
      if (killedPlayer === gameState.mayor) {
        gameState.mayor = null;
      }
      if (killedPlayer === gameState.president) {
        gameState.president = null;
      }
      await channel.send(
        `💀 **<@${killedPlayer}> was killed tonight. Their role was: ${role.toUpperCase()}**`
      );
    } else if (killedPlayer && killedPlayer === protectedPlayer) {
      await channel.send(
        `💉 **The killing failed because <@${protectedPlayer}> was protected by the doctor.**`
      );
    }

    gameState.killedPlayer = null;
    gameState.protectedPlayer = null;

    if (checkWinConditions(channel)) {
      return;
    }

    if (gameState.gameActive) {
      const timeout = setTimeout(() => startVotePhase(channel), 3000);
      gameTimeouts.push(timeout);
    }
  } catch (error) {
    console.error("Error in resolveNightPhase:", error);
    await channel.send(
      "❌ **An error occurred while ending the night phase.**"
    );
  }
}

function checkWinConditions(channel) {
  try {
    const mafiaCount = gameState.players.filter(
      (player) => gameState.playerRoles.get(player) === "mafia"
    ).length;

    const citizenCount = gameState.players.length - mafiaCount;

    let winner = null;

    if (mafiaCount === 0) {
      winner = "🎉 **The citizens win!**";
    } else if (mafiaCount >= citizenCount) {
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
    gameState.votePhaseActive = true;

    if (gameState.voteTimeout) {
      clearTimeout(gameState.voteTimeout);
      gameState.voteTimeout = null;
    }

    const alivePlayers = gameState.players;

    if (alivePlayers.length <= 2) {
      if (checkWinConditions(channel)) {
        return;
      }
    }

    // Create the voting buttons for players
    const buttons = alivePlayers.map((player) =>
      new ButtonBuilder()
        .setCustomId(`vote_${player}`)
        .setLabel(
          `${channel.guild.members.cache.get(player)?.displayName || "Unknown"}`
        )
        .setStyle(ButtonStyle.Secondary)
    );

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

    const controlButtonsRow = new ActionRowBuilder().addComponents(
      skipButton,
      presidentButton
    );

    await disableButtonsInChannel(channel);

    await channel.send({
      content:
        "🗳️ **It is time to vote! Choose who you think is the mafia or choose to skip voting.**",
      components: [...votingButtonRows, controlButtonsRow],
    });

    gameState.voteTimeout = setTimeout(
      () => tallyVotes(channel),
      config.citizenVoteTime
    );
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

    if (!gameState.votes.has(interaction.user.id)) {
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

      gameState.votes.set(interaction.user.id, {
        target: playerId,
        weight: voteWeight,
      });
      gameState.totalVotes += 1;

      let voteDisplayCounts = new Map();
      for (const vote of gameState.votes.values()) {
        if (vote.target !== "skip") {
          voteDisplayCounts.set(
            vote.target,
            (voteDisplayCounts.get(vote.target) || 0) + vote.weight
          );
        }
      }

      const updatedComponents = interaction.message.components.map((row) =>
        new ActionRowBuilder().addComponents(
          row.components.map((button) => {
            const targetPlayerId = button.customId.split("_")[1];
            if (button.customId === "skip_vote") return button;
            if (button.customId === "president_ability") return button;

            const voteCount = voteDisplayCounts.get(targetPlayerId) || 0;

            return ButtonBuilder.from(button).setLabel(
              `${
                interaction.guild.members.cache.get(targetPlayerId)
                  ?.displayName || "Unknown"
              } (${voteCount})`
            );
          })
        )
      );

      await interaction.message.edit({
        content: interaction.message.content,
        components: updatedComponents,
      });

      await checkIfAllVotedOrTimeout(interaction.channel);
    } else {
      await interaction.reply({
        content: "❌ **You have already voted.**",
        ephemeral: true,
      });
    }
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

    if (!gameState.votes.has(interaction.user.id)) {
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
      gameState.skipVotes += voteWeight;
      gameState.totalVotes += 1;

      const updatedComponents = interaction.message.components.map((row) =>
        new ActionRowBuilder().addComponents(
          row.components.map((button) => {
            if (button.customId === "skip_vote") {
              return ButtonBuilder.from(button).setLabel(
                `Skip Vote (${gameState.skipVotes})`
              );
            }
            return button;
          })
        )
      );

      await interaction.message.edit({
        content: interaction.message.content,
        components: updatedComponents,
      });

      await checkIfAllVotedOrTimeout(interaction.channel);
    } else {
      await interaction.reply({
        content: "❌ **You have already voted.**",
        ephemeral: true,
      });
    }
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

    const buttons = alivePlayers.map((player) =>
      new ButtonBuilder()
        .setCustomId(`president_select_${player}`)
        .setLabel(
          `${
            interaction.guild.members.cache.get(player)?.displayName ||
            "Unknown"
          }`
        )
        .setStyle(ButtonStyle.Danger)
    );

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
    if (gameState.totalVotes >= remainingPlayers && gameState.votePhaseActive) {
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
      gameState.players = gameState.players.filter(
        (player) => player !== expelledPlayer
      );

      const role = gameState.playerRoles.get(expelledPlayer);
      if (role === "mafia") {
        gameState.mafias = gameState.mafias.filter(
          (mafia) => mafia !== expelledPlayer
        );
      }
      if (expelledPlayer === gameState.doctor) {
        gameState.doctor = null;
      }
      if (expelledPlayer === gameState.detector) {
        gameState.detector = null;
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

      await channel.send(
        `🚫 **<@${expelledPlayer}> has been expelled from the game. Their role was: ${role.toUpperCase()}**`
      );
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

  const timeout = setTimeout(() => startMafiaPhase(channel), 3000);
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
