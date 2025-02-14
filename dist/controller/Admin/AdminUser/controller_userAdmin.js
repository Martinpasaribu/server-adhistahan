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
exports.AdminUserController = void 0;
const argon2_1 = __importDefault(require("argon2"));
const uuid_1 = require("uuid");
const dotenv_1 = __importDefault(require("dotenv"));
const models_admin_1 = __importDefault(require("../../../models/Admin/models_admin"));
dotenv_1.default.config();
class AdminUserController {
    static getAdmin(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const users = yield models_admin_1.default.find();
                res.status(200).json(users);
            }
            catch (error) {
                console.log(error);
            }
        });
    }
    static RegisterAdmin(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { title, username, password, status, role } = req.body;
            try {
                if (!title || !username || !password || !status || !role) {
                    return res.status(400).json({
                        requestId: (0, uuid_1.v4)(),
                        message: `All Field can't be empty`,
                    });
                }
                // argon2 lebih tahan terhadap serangan GPU brute-force.
                const hashPassword = yield argon2_1.default.hash(password);
                // const salt = await bcrypt.genSalt();
                // const hashPassword = await bcrypt.hash(password, salt);
                const user = yield models_admin_1.default.create({
                    title: title,
                    username: username,
                    role: role,
                    status: status,
                    active: true,
                    password: hashPassword,
                });
                res.status(201).json({
                    requestId: (0, uuid_1.v4)(),
                    data: user,
                    message: "Successfully register user.",
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
}
exports.AdminUserController = AdminUserController;
