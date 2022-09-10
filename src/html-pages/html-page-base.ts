import type { Player } from "../room-activity";
import type { Room } from "../rooms";
import type { User } from "../users";
import type { ComponentBase } from "./components/component-base";

export interface IQuietPMButtonOptions {
	disabled?: boolean;
	enabledReadonly?: boolean;
	selected?: boolean;
	selectedAndDisabled?: boolean;
	style?: string;
}

export const CLOSE_COMMAND = 'closehtmlpage';
export const SWITCH_LOCATION_COMMAND = 'switchhtmlpagelocation';

export abstract class HtmlPageBase {
	abstract pageId: string;

	baseChatUhtmlName: string = "";
	chatUhtmlName: string = "";
	closed: boolean = false;
	closeButtonHtml: string = "";
	components: ComponentBase[] = [];
	globalRoomPage: boolean = false;
	lastRender: string = '';
	readonly: boolean = false;
	showSwitchLocationButton: boolean = false;
	switchLocationButtonHtml: string = "";
	usedCommandAfterLastRender: boolean = false;

	baseCommand: string;
	commandPrefix: string;
	pageList: Dict<HtmlPageBase>;
	room: Room;

	isRoomStaff!: boolean;
	userName!: string;
	userId!: string;

	constructor(room: Room, userOrPlayer: User | Player, baseCommand: string, pageList: Dict<HtmlPageBase>) {
		this.room = room;
		this.baseCommand = baseCommand;
		this.commandPrefix = Config.commandCharacter + baseCommand + " " + (room.alias || room.id);
		this.pageList = pageList;

		this.setUser(userOrPlayer);
		this.setCloseButton();

		if (userOrPlayer.id in pageList) pageList[userOrPlayer.id].destroy();
		pageList[userOrPlayer.id] = this;
	}

	abstract render(onOpen?: boolean): string;

	destroy(): void {
		for (const component of this.components) {
			component.destroy();
		}

		delete this.pageList[this.userId];

		this.closed = true;
		Tools.unrefProperties(this, ['closed', 'pageId', 'userName', 'userId']);
	}

	open(): void {
		this.send(true);
	}

	tryClose(): void {
		if (!this.closed) this.close();
	}

	close(): void {
		if (this.closed) throw new Error(this.pageId + " page already closed for user " + this.userId);

		const user = Users.get(this.userId);
		if (user) this.room.closeHtmlPage(user, this.pageId);

		if (this.onClose) this.onClose();
		this.destroy();
	}

	temporarilyClose(): void {
		const user = Users.get(this.userId);
		if (user) this.room.closeHtmlPage(user, this.pageId);
	}

	switchLocation(): void {
		let closeHtmlPage = true;
		if (this.chatUhtmlName) {
			closeHtmlPage = false;
			this.chatUhtmlName = "";
		} else {
			this.chatUhtmlName = this.baseChatUhtmlName;
		}

		this.usedCommandAfterLastRender = true;
		this.setSwitchLocationButton();
		this.setCloseButton();
		this.send();

		const user = Users.get(this.userId);
		if (user) {
			if (closeHtmlPage) {
				this.temporarilyClose();
			} else {
				this.room.sayPrivateUhtml(user, this.baseChatUhtmlName, "<div>Successfully moved to an HTML page.</div>");
			}
		}
	}

	setUser(userOrPlayer: User | Player): void {
		this.userName = userOrPlayer.name;
		this.userId = userOrPlayer.id;

		const user = Users.get(userOrPlayer.name);
		this.isRoomStaff = user ? user.hasRank(this.room, 'driver') || user.isDeveloper() : false;
	}

	onRenameUser(user: User, oldId: string): void {
		if (!(oldId in this.pageList)) return;

		if (oldId === user.id) {
			this.userName = user.name;
			return;
		}

		if (user.id in this.pageList) {
			this.pageList[oldId].destroy();
		} else {
			this.setUser(user);
			this.pageList[user.id] = this;
		}

		delete this.pageList[oldId];
	}

	send(onOpen?: boolean): void {
		if (this.closed) return;

		if (this.beforeSend && !this.beforeSend(onOpen)) return;

		const user = Users.get(this.userId);
		if (!user) return;

		const render = this.render(onOpen);
		if (render === this.lastRender && !this.usedCommandAfterLastRender) return;

		this.lastRender = render;
		this.usedCommandAfterLastRender = false;

		if (this.chatUhtmlName) {
			this.room.sayPrivateUhtml(user, this.chatUhtmlName, render);
		} else {
			this.room.sendHtmlPage(user, this.pageId, render);
		}

		if (this.onSend) this.onSend(onOpen);
	}

	checkComponentCommands(componentCommand: string, targets: readonly string[]): string | undefined {
		for (const component of this.components) {
			if (component.active && component.componentCommand === componentCommand) {
				this.usedCommandAfterLastRender = true;
				return component.tryCommand(targets);
			}
		}

		return "Unknown sub-command '" + componentCommand + "'.";
	}

	getQuietPmButton(message: string, label: string, options?: IQuietPMButtonOptions): string {
		let disabled = options && (options.disabled || options.selectedAndDisabled);
		if (!disabled && options && !options.enabledReadonly && this.readonly) disabled = true;

		let style = options && options.style ? options.style : "";
		if (options && (options.selected || options.selectedAndDisabled)) {
			if (style && !style.endsWith(';')) style += ';';
			style += 'border-color: #ffffff;';
		}

		return Client.getQuietPmButton(this.room, message, label, disabled, style);
	}

	setCloseButton(options?: IQuietPMButtonOptions): void {
		if (this.chatUhtmlName) {
			this.closeButtonHtml = "";
		} else {
			this.closeButtonHtml = this.getQuietPmButton(this.commandPrefix + (this.globalRoomPage ? " " : ", ") + CLOSE_COMMAND,
				"Close page", options);
		}
	}

	setSwitchLocationButton(): void {
		if (this.showSwitchLocationButton) {
			this.switchLocationButtonHtml = this.getQuietPmButton(this.commandPrefix + (this.globalRoomPage ? " " : ", ") +
			SWITCH_LOCATION_COMMAND, "Move to " + (this.chatUhtmlName ? "HTML page" : "chat"));
		} else {
			this.switchLocationButtonHtml = "";
		}
	}

	beforeSend?(onOpen?: boolean): boolean;
	onClose?(): void;
	onOpen?(): void;
	onSend?(onOpen?: boolean): void;
}
