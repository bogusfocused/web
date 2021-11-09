import { Component, OnInit } from '@angular/core';

import { CipherService } from 'jslib-common/abstractions/cipher.service';
import { MessagingService } from 'jslib-common/abstractions/messaging.service';
import { PasswordGenerationService } from 'jslib-common/abstractions/passwordGeneration.service';
import { PasswordRepromptService } from 'jslib-common/abstractions/passwordReprompt.service';
import { UserService } from 'jslib-common/abstractions/user.service';

import { ModalService } from 'jslib-angular/services/modal.service';

import { CipherView } from 'jslib-common/models/view/cipherView';

import { CipherType } from 'jslib-common/enums/cipherType';

import { LoginUriView } from 'jslib-common/models/view/loginUriView';
import * as tldjs from 'tldjs';
import { CipherReportComponent } from './cipher-report.component';

type Merges = [target: CipherView, sources: CipherView[]];

@Component({
    selector: 'app-duplicate-passwords-report',
    templateUrl: 'duplicate-passwords-report.component.html',
})
export class DuplicatePasswordsReportComponent
    extends CipherReportComponent
    implements OnInit {

    groupedCipher: Merges[] = [];

    constructor(
        protected cipherService: CipherService,
        protected passwordGenerationService: PasswordGenerationService,
        modalService: ModalService,
        messagingService: MessagingService,
        userService: UserService,
        passwordRepromptService: PasswordRepromptService
    ) {
        super(
            modalService,
            userService,
            messagingService,
            passwordRepromptService,
            true
        );
    }

    async ngOnInit() {
        if (await this.checkAccess()) {
            await super.load();
        }
    }

    async setCiphers() {
        const grouped = new Map<string, Merges>();
        const getGroupByKey = (c: CipherView): string[] => {
            return c.login.uris.map(u => {
                if (u.uri.startsWith('androidapp://'))
                    u.uri = 'android://' + u.uri.substr(13);
                const domain = tldjs.getDomain(u.uri) || u.domain;
                return JSON.stringify([c.login.password, c.login.username?.toLocaleLowerCase(), domain]);
            });
        };
        const mergeInto = async (entry: Merges, toBeMerged: CipherView) => {
            if (!entry) return false;
            const target = entry[0];
            if (target.type === CipherType.Login && toBeMerged.type === CipherType.Login) {
                toBeMerged.login.uris.forEach(u => {
                    if (target.login.uris.find(v => v.uri === u.uri))
                        return;
                    const luv = new LoginUriView();
                    luv.uri = u.uri;
                    target.login.uris.push(luv);
                });
                if (toBeMerged.login.hasTotp && !target.login.hasTotp)
                    target.login.totp = toBeMerged.login.totp;
                target.notes += toBeMerged.notes;
                entry[1].push(toBeMerged);
                return true;
            }
            return false;
        };
        const allCiphers = await this.getAllCiphers();
        cipherloop: for (const c of allCiphers) {
            if (
                c.type !== CipherType.Login ||
                c.login.password == null || c.login.password === '' ||
                !c.login.hasUris ||
                c.isDeleted
            ) continue;

            const groupByKeys = getGroupByKey(c);

            for (const groupByKey of groupByKeys) {
                if (await mergeInto(grouped.get(groupByKey), c))
                    continue cipherloop;
            }
            const lastKey = groupByKeys[groupByKeys.length - 1];
            grouped.set(lastKey, [c, []]);
        }


        this.groupedCipher = Array.from(grouped.values()).filter(m => m[1].length > 0);

        for (const m of this.groupedCipher) {
            const cipher = await this.cipherService.encrypt(m[0]);
            await this.cipherService.saveWithServer(cipher);
            await this.cipherService.softDeleteManyWithServer(m[1].map(s => s.id));
        }

    }



    protected getAllCiphers(): Promise<CipherView[]> {
        return this.cipherService.getAllDecrypted();
    }

    protected canManageCipher(c: CipherView): boolean {
        // this will only ever be false from the org view;
        return true;
    }



}
