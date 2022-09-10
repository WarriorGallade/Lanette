import type { Room } from "../rooms";
import type { BaseCommandDefinitions } from "../types/command-parser";
import type { User } from "../users";
import { CLOSE_COMMAND } from "./html-page-base";
import { TournamentTrainerCard } from "./tournament-trainer-card";

const baseCommand = 'tournamentpointsshop';
const baseCommandAlias = 'tpshop';
const unlockRibbonCommand = 'unlockribbon';

export const pageId = 'tournament-points-shop';
export const pages: Dict<TournamentPointsShop> = {};

class TournamentPointsShop extends TournamentTrainerCard {
	pageId = pageId;

	constructor(room: Room, user: User) {
		super(room, user, baseCommandAlias, {}, pages);

		this.components = [];
	}

	unlockRibbon(id: string): void {
		if (!Config.tournamentPointsShopRibbons || !(this.trainerCardRoom.id in Config.tournamentPointsShopRibbons) ||
			!(id in Config.tournamentPointsShopRibbons[this.trainerCardRoom.id])) return;

		const database = this.getDatabase();
		Storage.createTournamentTrainerCard(database, this.userId);

		if (!database.unlockedTournamentPointsShopRibbons) database.unlockedTournamentPointsShopRibbons = {};

		if (!(this.userId in database.unlockedTournamentPointsShopRibbons)) {
			database.unlockedTournamentPointsShopRibbons[this.userId] = [];
		} else if (database.unlockedTournamentPointsShopRibbons[this.userId].includes(id)) {
			return;
		}

		database.unlockedTournamentPointsShopRibbons[this.userId].push(id);

		if (!database.tournamentTrainerCards![this.userId].ribbons) {
			database.tournamentTrainerCards![this.userId].ribbons = [];
		} else if (database.tournamentTrainerCards![this.userId].ribbons!.includes(id)) {
			return;
		}

		database.tournamentTrainerCards![this.userId].ribbons!.push(id);

		this.send();
	}

	getItemsHtml(): string {
		let html = "";

		if (Config.tournamentPointsShopRibbons && this.trainerCardRoom.id in Config.tournamentPointsShopRibbons) {
			const database = this.getDatabase();
			const points = Storage.getAnnualPoints(this.room, 'tournamentLeaderboard', this.userName);
			const bits = Storage.getAnnualPoints(this.room, 'gameLeaderboard', this.userName);

			let ribbonsHtml = "";
			for (const id in Config.tournamentPointsShopRibbons[this.trainerCardRoom.id]) {
				const ribbon = Config.tournamentPointsShopRibbons[this.trainerCardRoom.id][id];
				const pointsCost = ribbon.pointsOverride && this.room.id in ribbon.pointsOverride ? ribbon.pointsOverride[this.room.id] :
					ribbon.points;
				const bitsCost = ribbon.bitsOverride && this.room.id in ribbon.bitsOverride ? ribbon.bitsOverride[this.room.id] :
					ribbon.bits;

				const unlocked = database.unlockedTournamentPointsShopRibbons &&
					this.userId in database.unlockedTournamentPointsShopRibbons &&
					database.unlockedTournamentPointsShopRibbons[this.userId].includes(id);
				const staffOnly = !pointsCost && !bitsCost;

				ribbonsHtml += this.getQuietPmButton(this.commandPrefix + ", " + unlockRibbonCommand + ", " + id,
					"<img src='" + ribbon.source + "' width=" + ribbon.width + "px height=" + ribbon.height + "px /><br />" +
					ribbon.name, {disabled: unlocked || (pointsCost > points && bitsCost > bits) || (staffOnly && !this.isRoomStaff),
					selected: unlocked});

				ribbonsHtml += "&nbsp;-&nbsp;";
				if (staffOnly) {
					ribbonsHtml += "Staff-only";
				} else {
					if (pointsCost && bitsCost) {
						ribbonsHtml += pointsCost + " points or " + bitsCost + " bits";
					} else if (pointsCost) {
						ribbonsHtml += pointsCost + " points";
					} else if (bitsCost) {
						ribbonsHtml += bitsCost + " bits";
					}
				}

				if (unlocked) ribbonsHtml += "&nbsp;(<b>unlocked</b>)";
				ribbonsHtml += "<br /><br />";
			}

			if (ribbonsHtml) {
				html += "<hr /><b>Ribbons</b>: these are displayed in the footer of your tournament trainer card";
				html += "<br /><br />";
				html += ribbonsHtml;
			}
		}

		if (html) {
			return "<b>The following items are able to be unlocked if you have the required amount of annual points or bits!</b><br />" +
				"<ul><li>Your points and bits will not be removed</li><li>Requirements may be different between rooms</li></ul>" +
				html;
		} else {
			return "<b>There are no items available at the moment!</b>";
		}
	}

	render(): string {
		let html = "<div class='chat' style='margin-top: 4px;margin-left: 4px'><center><b>" +
			this.room.title + ": Tournament Points Shop</b>";
		html += "&nbsp;" + this.closeButtonHtml;

		const currentCard = Tournaments.getTrainerCardHtml(this.room, this.userName);
		if (currentCard) {
			html += "<br />";
			html += currentCard;
		}

		html += "</center>";
		html += "<br /><br />";

		html += this.getItemsHtml();

		html += "</div>";
		return html;
	}
}

export const commands: BaseCommandDefinitions = {
	[baseCommand]: {
		command(target, room, user) {
			if (!this.isPm(room)) return;
			const targets = target.split(",");
			const targetRoom = Rooms.search(targets[0]);
			if (!targetRoom) return this.sayError(['invalidBotRoom', targets[0]]);
			targets.shift();

			if (!Config.tournamentPointsShop || !Config.tournamentPointsShop.includes(targetRoom.id)) return;

			const cmd = Tools.toId(targets[0]);
			targets.shift();

			if (!cmd) {
				new TournamentPointsShop(targetRoom, user).open();
				return;
			}

			if (!(user.id in pages) && cmd !== CLOSE_COMMAND) new TournamentPointsShop(targetRoom, user);

			if (cmd === CLOSE_COMMAND) {
				if (user.id in pages) pages[user.id].close();
			} else if (cmd === unlockRibbonCommand) {
				if (user.id in pages) pages[user.id].unlockRibbon(targets[0].trim());
			} else {
				const error = pages[user.id].checkComponentCommands(cmd, targets);
				if (error) this.say(error);
			}
		},
		aliases: [baseCommandAlias],
	},
};