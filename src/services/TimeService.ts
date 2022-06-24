import {Moment} from "moment/moment"
import moment from "moment"

export interface TimeService {
    timestamp(): Moment
}

export const timeServiceImpl: TimeService = {
    timestamp(): moment.Moment {
        return moment()
    }
}