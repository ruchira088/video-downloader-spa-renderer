import {Moment} from "moment/moment"
import moment from "moment"

export interface Clock {
    timestamp(): Moment
}

export const defaultClock: Clock = {
    timestamp(): moment.Moment {
        return moment()
    }
}