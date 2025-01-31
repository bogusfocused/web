import {
    Component,
    OnInit,
} from '@angular/core';

import { ToasterService } from 'angular2-toaster';

import { ApiService } from 'jslib-common/abstractions/api.service';
import { CryptoService } from 'jslib-common/abstractions/crypto.service';
import { I18nService } from 'jslib-common/abstractions/i18n.service';
import { LogService } from 'jslib-common/abstractions/log.service';
import { UserService } from 'jslib-common/abstractions/user.service';

import { UpdateProfileRequest } from 'jslib-common/models/request/updateProfileRequest';

import { ProfileResponse } from 'jslib-common/models/response/profileResponse';

@Component({
    selector: 'app-profile',
    templateUrl: 'profile.component.html',
})
export class ProfileComponent implements OnInit {
    loading = true;
    profile: ProfileResponse;
    fingerprint: string;

    formPromise: Promise<any>;

    constructor(private apiService: ApiService, private i18nService: I18nService,
        private toasterService: ToasterService, private userService: UserService,
        private cryptoService: CryptoService, private logService: LogService) { }

    async ngOnInit() {
        this.profile = await this.apiService.getProfile();
        this.loading = false;
        const fingerprint = await this.cryptoService.getFingerprint(await this.userService.getUserId());
        if (fingerprint != null) {
            this.fingerprint = fingerprint.join('-');
        }
    }

    async submit() {
        try {
            const request = new UpdateProfileRequest(this.profile.name, this.profile.masterPasswordHint);
            this.formPromise = this.apiService.putProfile(request);
            await this.formPromise;
            this.toasterService.popAsync('success', null, this.i18nService.t('accountUpdated'));
        } catch (e) {
            this.logService.error(e);
        }
    }
}
