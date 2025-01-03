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
exports.BookingController = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const uuid_1 = require("uuid");
const models_room_1 = __importDefault(require("../../models/Room/models_room"));
const models_booking_1 = require("../../models/Booking/models_booking");
const midtransConfig_1 = require("../../config/midtransConfig");
const transactionService_1 = require("./transactionService");
const constant_1 = require("../../utils/constant");
const models_session_1 = require("../../models/Booking/models_session");
const models_transaksi_1 = require("../../models/Booking/models_transaksi");
const Update_Status_1 = require("./Update_Status");
class BookingController {
    static addBooking(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const BookingReq = req.body;
            try {
                const roomDetails = yield models_room_1.default.find({ _id: { $in: BookingReq.room.map((r) => r.roomId) } });
                // Validate room availability
                for (const roomBooking of BookingReq.room) {
                    const room = roomDetails.find(r => r._id.toString() === roomBooking.roomId.toString());
                    if (!room) {
                        return res.status(400).json({ status: 'error', message: `Room with ID ${roomBooking.roomId} not found` });
                    }
                    // Check if the room is sold out or requested quantity exceeds availability
                    if (room.available <= 0) {
                        return res.status(400).json({ status: 'error', message: `Room with ID ${roomBooking.roomId} is sold out` });
                    }
                    if (roomBooking.quantity > room.available) {
                        return res.status(400).json({
                            status: 'error',
                            message: `Room with ID ${roomBooking.roomId} has only ${room.available} available, but you requested ${roomBooking.quantity}`
                        });
                    }
                }
                // Calculate gross_amount
                const grossAmount = roomDetails.reduce((acc, room) => {
                    const roomBooking = BookingReq.room.find((r) => r.roomId.toString() === room._id.toString());
                    return acc + room.price * roomBooking.quantity;
                }, 0);
                const bookingId = (0, uuid_1.v4)();
                // Create transaction in Midtrans
                const midtransPayload = {
                    transaction_details: {
                        order_id: `order-${bookingId}`,
                        gross_amount: grossAmount,
                    },
                    customer_details: {
                        first_name: "Customer", // Replace with actual customer details if available
                        email: "customer@example.com", // Replace with actual email if available
                    },
                    item_details: roomDetails.map(room => {
                        const roomBooking = BookingReq.room.find((r) => r.roomId.toString() === room._id.toString());
                        return {
                            id: room._id,
                            price: room.price,
                            quantity: roomBooking.quantity,
                            name: room.name,
                        };
                    }),
                };
                const midtransResponse = yield midtransConfig_1.snap.createTransaction(midtransPayload);
                // Save transaction to your database
                const transaction = yield transactionService_1.transactionService.createTransaction({
                    bookingId,
                    status: constant_1.PENDING_PAYMENT,
                    checkIn: BookingReq.checkIn, // Tambahkan properti ini jika dibutuhkan
                    checkOut: BookingReq.checkOut, // Tambahkan properti ini jika dibutuhkan
                    grossAmount,
                    userId: (0, uuid_1.v4)(),
                    products: roomDetails.map(room => {
                        const roomBooking = BookingReq.room.find((r) => r.roomId.toString() === room._id.toString());
                        return {
                            roomId: room._id,
                            quantity: roomBooking === null || roomBooking === void 0 ? void 0 : roomBooking.quantity, // Optional chaining jika roomBooking tidak ditemukan
                            price: room.price, // Menambahkan price dari room
                        };
                    }),
                    snap_token: midtransResponse.token,
                    paymentUrl: midtransResponse.redirect_url,
                });
                // Save booking (transaction) to your database
                const bookingData = {
                    orderId: bookingId,
                    checkIn: BookingReq.checkIn,
                    checkOut: BookingReq.checkOut,
                    adult: BookingReq.adult,
                    children: BookingReq.children,
                    amountTotal: grossAmount,
                    amountBefDisc: BookingReq.amountBefDisc || grossAmount, // Assuming discount might apply
                    couponId: BookingReq.couponId || null, // Optional coupon ID
                    idUser: (0, uuid_1.v4)(), // Replace with the actual user ID if available
                    creatorId: (0, uuid_1.v4)(), // Replace with actual creator ID if available
                    rooms: roomDetails.map(room => {
                        const roomBooking = BookingReq.room.find((r) => r.roomId.toString() === room._id.toString());
                        return {
                            roomId: room._id,
                            quantity: roomBooking.quantity,
                        };
                    }),
                };
                const booking = yield transactionService_1.transactionService.createBooking(bookingData);
                res.status(201).json({
                    status: 'success',
                    data: {
                        message: ' successfully On Checkout',
                        id: bookingId,
                        transaction,
                        paymentUrl: midtransResponse.redirect_url,
                        snap_token: midtransResponse.token
                    }
                });
                // res.status(201).json(
                //     {
                //         requestId: uuidv4(), 
                //         data: {
                //             acknowledged: true,
                //             insertedId: savedBooking._id 
                //         },
                //         message: "Successfully Add Booking ",
                //         success: true
                //     }
                // );
            }
            catch (error) {
                res.status(400).json({
                    requestId: (0, uuid_1.v4)(),
                    data: null,
                    message: error.message,
                    success: false
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
    static getOffers(req, res) {
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
    static getRoomByParams(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            let data;
            const { id } = req.params;
            try {
                new mongoose_1.default.Types.ObjectId(id),
                    data = yield models_room_1.default.find({ _id: id, isDeleted: false });
                res.status(201).json({
                    requestId: (0, uuid_1.v4)(),
                    data: data,
                    message: "Successfully Fetch Data Room by Params.",
                    success: true
                });
            }
            catch (error) {
                res.status(400).json({
                    requestId: (0, uuid_1.v4)(),
                    data: null,
                    message: error.message,
                    RoomId: `Room id : ${id}`,
                    success: false
                });
            }
        });
    }
    static deletedRoomPermanent(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const deletedRoom = yield models_room_1.default.findOneAndDelete({ _id: id });
                res.status(201).json({
                    requestId: (0, uuid_1.v4)(),
                    data: deletedRoom,
                    message: "Successfully DeletedPermanent Data Room as Cascade .",
                    success: true
                });
            }
            catch (error) {
                res.status(400).json({
                    requestId: (0, uuid_1.v4)(),
                    data: null,
                    message: error.message,
                    success: false
                });
            }
        });
    }
    static updatePacketAll(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            const updateData = req.body;
            try {
                const updatedPacket = yield models_room_1.default.findOneAndUpdate({ _id: id }, updateData, { new: true, runValidators: true });
                if (!updatedPacket) {
                    return res.status(404).json({
                        requestId: (0, uuid_1.v4)(),
                        success: false,
                        message: "Packet not found",
                    });
                }
                res.status(200).json({
                    requestId: (0, uuid_1.v4)(),
                    success: true,
                    message: "Successfully updated Packet data",
                    data: updatedPacket
                });
            }
            catch (error) {
                res.status(400).json({
                    requestId: (0, uuid_1.v4)(),
                    success: false,
                    message: error.message,
                });
            }
        });
    }
    ;
    static updateRoomPart(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            const updateData = req.body;
            // if (updateData._id) {
            //     delete updateData._id;
            // }
            try {
                const updatedRoom = yield models_room_1.default.findOneAndUpdate(
                // new mongoose.Types.ObjectId(id),        
                { _id: id }, updateData, { new: true, runValidators: true });
                if (!updatedRoom) {
                    return res.status(404).json({
                        requestId: (0, uuid_1.v4)(),
                        success: false,
                        message: "Room not found",
                    });
                }
                res.status(200).json({
                    requestId: (0, uuid_1.v4)(),
                    success: true,
                    message: "Successfully updated Room data",
                    data: updatedRoom
                });
            }
            catch (error) {
                res.status(400).json({
                    requestId: (0, uuid_1.v4)(),
                    success: false,
                    message: error.message,
                });
            }
        });
    }
    ;
    // static async deletedSoftRoom(req: Request, res: Response) {
    //     try {
    //         let data ;
    //         const { id } = req.params;
    //         data = await RoomModel.findByIdAndUpdate(id, { isDeleted: true },{ new: true, runValidators: true });
    //         if (!data) {
    //             return res.status(404).json({
    //                 requestId: uuidv4(),
    //                 data: null,
    //                 message: "Room not found.",
    //                 success: false
    //             });
    //         }
    //         await ModuleModel.updateMany(
    //             { RoomId: id },
    //             { isDeleted: true }
    //         );
    //         const modules = await ModuleModel.find({ RoomId: id });
    //         const moduleId = modules.map((mod) => mod._id);
    //         await ChapterModel.updateMany(
    //             { moduleId: { $in: moduleId } },
    //             { isDeleted: true }
    //         );
    //         const chapters = await ChapterModel.find({ moduleId: { $in: moduleId } });
    //         const chapterId = chapters.map((ch) => ch._id);
    //         await QuestionModel.updateMany(
    //             { chapterId: { $in: chapterId } },
    //             { isDeleted: true }
    //         );
    //         res.status(201).json(
    //             {
    //                 requestId: uuidv4(), 
    //                 data: data,
    //                 message: `Successfully SoftDeleted Data : ${data} as Cascade `,
    //                 success: true
    //             }
    //         );
    //     } catch (error) {
    //         res.status(400).json(
    //             {
    //                 requestId: uuidv4(), 
    //                 data: null,
    //                 message:  (error as Error).message,
    //                 success: false
    //             }
    //         );
    //     }
    // }
    static PostChartRoom(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { roomId, quantity } = req.body;
            // Validasi input
            if (!roomId || quantity <= 0) {
                return res.status(400).json({ error: 'Invalid input' });
            }
            // Jika cart belum ada, inisialisasi
            if (!req.session.cart) {
                req.session.cart = [];
            }
            try {
                // Cari data kamar berdasarkan roomId
                const room = yield models_room_1.default.findById(roomId);
                if (!room) {
                    return res.status(404).json({ error: 'Room not found' });
                }
                const availableQty = room.available; // Ambil jumlah kamar yang tersedia
                const price = room.price; // Ambil harga dari database
                // Cari apakah roomId sudah ada di cart
                const existingItem = req.session.cart.find(item => item.roomId === roomId);
                if (existingItem) {
                    // Hitung jumlah total jika quantity ditambahkan
                    const newQuantity = existingItem.quantity + quantity;
                    if (newQuantity > availableQty) {
                        return res.status(400).json({
                            error: 'Requested quantity exceeds available rooms',
                            available: availableQty
                        });
                    }
                    // Tambahkan quantity jika valid
                    existingItem.quantity = newQuantity;
                }
                else {
                    // Periksa apakah jumlah yang diminta melebihi jumlah yang tersedia
                    if (quantity > availableQty) {
                        return res.status(400).json({
                            error: 'Requested quantity exceeds available rooms',
                            available: availableQty
                        });
                    }
                    // Tambahkan sebagai item baru
                    req.session.cart.push({ roomId, quantity, price });
                    req.session.deviceInfo = {
                        userAgent: req.get('User-Agent'), // Menyimpan informasi tentang browser/perangkat
                        ipAddress: req.ip, // Menyimpan alamat IP pengguna
                    };
                }
                // Hitung total harga
                const totalPrice = req.session.cart.reduce((total, item) => {
                    const itemPrice = Number(item.price);
                    const itemQuantity = Number(item.quantity);
                    return total + itemPrice * itemQuantity;
                }, 0);
                // Simpan perubahan ke session
                req.session.save(err => {
                    if (err) {
                        console.error('Error saving session:', err);
                        return res.status(500).json({ error: 'Failed to save session' });
                    }
                    res.json({
                        message: 'Item added to cart',
                        cart: req.session.cart,
                        totalPrice
                    });
                });
            }
            catch (error) {
                console.error('Error fetching room data:', error);
                res.status(500).json({ error: 'Internal server error' });
            }
        });
    }
    static DelChartRoom(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { itemId } = req.body; // Ambil itemId dari request body
            // Pastikan cart ada dan itemId diberikan
            if (!req.session.cart || !itemId) {
                return res.status(400).json({ message: 'Cart is empty or itemId not provided' });
            }
            // Temukan item yang ingin dihapus atau dikurangi quantity-nya
            const item = req.session.cart.find(item => item.roomId === itemId);
            if (!item) {
                return res.status(404).json({ message: 'Item not found in cart' });
            }
            // Jika quantity lebih dari 1, kurangi quantity-nya
            if (item.quantity > 1) {
                item.quantity -= 1;
            }
            else {
                // Jika quantity 1, hapus item dari cart
                req.session.cart = req.session.cart.filter(item => item.roomId !== itemId);
            }
            return res.json({ message: 'Item updated in cart', cart: req.session.cart });
        });
    }
    static GetChartRoom(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const sessionId = req.cookies["connect.sid"];
                if (!sessionId) {
                    return res.status(400).json({ error: "Session ID not provided" });
                }
                const session = yield models_session_1.SessionModel.findOne({ _id: sessionId });
                return res.status(200).json({
                    data: session,
                    message: 'Get Chart Sucsessfully'
                });
            }
            catch (error) {
                console.error('Error in GetChart:', error);
                return res.status(500).json({ error: 'Internal server error' });
            }
        });
    }
    ;
    static GetTotalPrice(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Debugging: Lihat session yang ada di setiap permintaan
                console.log('Session:', req.session);
                // Cek apakah cart ada di session
                if (!req.session.cart) {
                    req.session.cart = [];
                }
                // Ambil data cart dari session
                const cart = req.session.cart;
                console.log('Cart in server:', cart); // Debugging
                // Jika cart kosong, kirimkan respons error
                if (cart.length === 0) {
                    return res.status(404).json({ message: 'Cart is empty or not found in session' });
                }
                // Hitung total harga: price * quantity untuk setiap item, lalu jumlahkan
                const totalPrice = cart.reduce((total, item) => {
                    const price = Number(item.price);
                    const quantity = Number(item.quantity);
                    return total + price * quantity;
                }, 0);
                // Debugging totalPrice
                console.log('Total Price:', totalPrice); // Debugging
                // Kirim respons dengan cart dan total harga
                return res.status(200).json({
                    requestId: (0, uuid_1.v4)(),
                    data: cart,
                    totalPrice: totalPrice,
                    message: 'Successfully calculated total price.',
                    success: true,
                });
            }
            catch (error) {
                console.error('Error in GetTotalPrice:', error);
                res.status(500).json({
                    requestId: (0, uuid_1.v4)(),
                    data: null,
                    message: error.message,
                    success: false,
                });
            }
        });
    }
    static TrxNotif(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const data = req.body;
                // Menunggu hasil findOne
                const exitTransansaction = yield models_transaksi_1.TransactionModel.findOne({ bookingId: data.order_id });
                if (exitTransansaction) {
                    // Properti bookingId sekarang tersedia
                    const result = (0, Update_Status_1.updateStatusBaseOnMidtransResponse)(exitTransansaction.bookingId, data);
                    console.log('result = ', result);
                }
                else {
                    console.log('Transaction not found');
                }
                res.status(200).json({
                    status: 'success',
                    message: "OK"
                });
            }
            catch (error) {
                console.error('Error handling transaction notification:', error);
                res.status(500).json({
                    error: 'Internal Server Error'
                });
            }
        });
    }
    static CekSessions(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('Session data:', req.session);
            res.json(req.session);
        });
    }
    ;
    static Checkout(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const cart = req.session.cart;
            // Pastikan cart tidak kosong
            if (!cart || cart.length === 0) {
                return res.status(400).json({ error: 'Cart is empty' });
            }
            // Validasi ulang data di server (contoh: cek harga dan ketersediaan)
            // const isValid = await validateCart(cart); // Implementasi validasi tergantung kebutuhan
            // if (!isValid) {
            //   return res.status(400).json({ error: 'Invalid cart data' });
            // }
            // Simpan transaksi ke database
            // const transaction = await saveTransaction(cart);
            // Bersihkan session setelah checkout berhasil
            req.session.cart = [];
            // res.json({ message: 'Checkout successful', transactionId: transaction.id });
        });
    }
    ;
    static RemoveCart(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                req.session.destroy((err) => {
                    if (err) {
                        console.error('Error destroying session:', err);
                        return res.status(500).json({
                            requestId: (0, uuid_1.v4)(),
                            data: null,
                            message: 'Failed to delete session.',
                            success: false,
                        });
                    }
                    // Hapus cookie session
                    res.clearCookie('connect.sid'); // Ganti 'connect.sid' dengan nama cookie session Anda
                    res.status(200).json({
                        requestId: (0, uuid_1.v4)(),
                        message: 'Session successfully deleted in server.',
                        success: true,
                    });
                });
            }
            catch (error) {
                console.error('Error in RemoveCart:', error);
                res.status(500).json({
                    requestId: (0, uuid_1.v4)(),
                    data: null,
                    message: error.message,
                    success: false,
                });
            }
        });
    }
}
exports.BookingController = BookingController;
