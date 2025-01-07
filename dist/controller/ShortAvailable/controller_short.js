"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShortAvailableController = void 0;
const uuid_1 = require("uuid");
const models_booking_1 = require("../../models/Booking/models_booking");
const models_transaksi_1 = require("../../models/Transaction/models_transaksi");
const models_ShortAvailable_1 = require("../../models/ShortAvailable/models_ShortAvailable");
class ShortAvailableController {
    static getShortVila(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { checkin, checkout } = req.query;
            try {
                // Validasi dan konversi parameter checkin dan checkout
                if (!checkin || !checkout) {
                    return res.status(400).json({
                        requestId: (0, uuid_1.v4)(),
                        data: null,
                        message: "Check-in and check-out dates are required.",
                        success: false,
                    });
                }
                // Query ke MongoDB
                const data = yield models_booking_1.BookingModel.find({
                    isDeleted: false,
                    checkIn: checkin,
                    checkOut: checkout,
                });
                res.status(200).json({
                    requestId: (0, uuid_1.v4)(),
                    data: data,
                    message: `Successfully get vila.`,
                    success: true,
                });
            }
            catch (error) {
                res.status(500).json({
                    requestId: (0, uuid_1.v4)(),
                    data: null,
                    message: error.message,
                    success: false,
                });
            }
        });
    }
    static addBookedRoomForAvailable(data, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Membuat instance baru dengan data dari parameter
                const newAvailable = new models_ShortAvailable_1.ShortAvailableModel({
                    transactionId: data.transactionId,
                    userId: data.userId,
                    roomId: data.roomId,
                    status: data.status,
                    checkIn: data.checkIn,
                    checkOut: data.checkOut,
                    products: data.products,
                });
                // Menyimpan data ke database
                const savedShort = yield newAvailable.save();
                // Mengirimkan respon sukses
                res.status(201).json({
                    requestId: (0, uuid_1.v4)(),
                    data: {
                        acknowledged: true,
                        insertedId: savedShort._id,
                    },
                    message: "Successfully added room.",
                    success: true,
                });
            }
            catch (error) {
                // Menangani kesalahan dan mengirimkan respon gagal
                res.status(400).json({
                    requestId: (0, uuid_1.v4)(),
                    data: null,
                    message: error.message,
                    success: false,
                });
            }
        });
    }
    static getTransactionsById(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { transaction_id } = req.params;
            const transaction = yield models_transaksi_1.TransactionModel.findOne({ bookingId: transaction_id });
            if (!transaction) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Transaction not found'
                });
            }
            res.status(202).json({
                status: 'success',
                data: transaction
            });
        });
    }
    ;
}
exports.ShortAvailableController = ShortAvailableController;
