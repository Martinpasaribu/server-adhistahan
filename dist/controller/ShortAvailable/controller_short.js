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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShortAvailableController = void 0;
const uuid_1 = require("uuid");
const models_room_1 = __importDefault(require("../../models/Room/models_room"));
const models_booking_1 = require("../../models/Booking/models_booking");
const models_transaksi_1 = require("../../models/Transaction/models_transaksi");
const models_ShortAvailable_1 = require("../../models/ShortAvailable/models_ShortAvailable");
class ShortAvailableController {
    static getAvailableRooms(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { checkIn, checkOut } = req.body;
                if (!checkIn || !checkOut) {
                    return res.status(400).json({ message: "Tanggal check-in dan check-out diperlukan." });
                }
                // Konversi tanggal ke UTC
                const checkInDate = new Date(checkIn);
                const checkOutDate = new Date(checkOut);
                if (checkInDate >= checkOutDate) {
                    return res.status(400).json({ message: "Tanggal check-out harus lebih besar dari tanggal check-in." });
                }
                // Debug: Log input tanggal dalam UTC
                // console.log("CheckIn UTC:", checkInDate.toISOString());
                // console.log("CheckOut UTC:", checkOutDate.toISOString());
                // Fiks Booking { checkIn dan CheckOut} : { 12 PM & 15 PM }
                // Query untuk mencari unavailable rooms
                const unavailableRooms = yield models_ShortAvailable_1.ShortAvailableModel.find({
                    status: "PAID",
                    $or: [
                        {
                            checkIn: { $lt: checkOutDate.toISOString() },
                            checkOut: { $gt: checkInDate.toISOString() },
                        },
                    ],
                });
                // Debug: Log hasil query unavailableRooms
                // console.log("Unavailable Rooms:", unavailableRooms);
                // Hitung jumlah room yang sudah dipesan
                const roomUsageCount = {};
                unavailableRooms.forEach((transaction) => {
                    transaction.products.forEach((product) => {
                        const roomId = product.roomId.toString();
                        roomUsageCount[roomId] = (roomUsageCount[roomId] || 0) + product.quantity;
                    });
                });
                // Debug: Log hasil roomUsageCount
                // console.log("Room Usage Count:", roomUsageCount);
                // Ambil semua room dari database
                const allRooms = yield models_room_1.default.find({ isDeleted: false });
                // Debug: Log semua room
                // console.log("All Rooms:", allRooms);
                // Filter room yang tersedia
                const availableRooms = allRooms
                    .map((room) => {
                    const usedCount = roomUsageCount[room._id.toString()] || 0;
                    const availableCount = room.available - usedCount;
                    return Object.assign(Object.assign({}, room.toObject()), { availableCount: availableCount > 0 ? availableCount : 0 });
                })
                    .filter((room) => room.availableCount > 0);
                // Debug: Log room yang tersedia
                // console.log("Available Rooms:", availableRooms);
                res.status(200).json({
                    requestId: (0, uuid_1.v4)(),
                    data: availableRooms,
                    message: `Successfully retrieved rooms. From Date: ${checkInDate.toISOString()} To: ${checkOutDate.toISOString()}`,
                    success: true,
                });
            }
            catch (error) {
                console.error(error);
                res.status(500).json({
                    requestId: (0, uuid_1.v4)(),
                    data: null,
                    message: error.message,
                    success: false,
                });
            }
        });
    }
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
                    status: data.status,
                    checkIn: data.checkIn,
                    checkOut: data.checkOut,
                    products: data.products.map((products) => ({
                        roomId: products.roomId,
                        price: products.price,
                        quantity: products.quantity,
                        name: products.name
                    }))
                });
                // Menyimpan data ke database
                const savedShort = yield newAvailable.save();
                // // Mengirimkan respon sukses
                //   return {
                //     success: true,
                //     message: "Successfully added room.",
                //     data: {
                //         acknowledged: true,
                //         insertedId: savedShort._id,
                //     },
                // };
            }
            catch (error) {
                // Menangani kesalahan dan mengirimkan respon gagal
                // Lemparkan error untuk ditangani oleh fungsi pemanggil
                throw new Error(error.message);
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
