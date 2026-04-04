import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import categoriesRouter from "./categories";
import productsRouter from "./products";
import paymentMethodsRouter from "./payment-methods";
import floorsRouter from "./floors";
import customersRouter from "./customers";
import posConfigRouter from "./pos-config";
import sessionsRouter from "./sessions";
import ordersRouter from "./orders";
import paymentsRouter from "./payments";
import kitchenRouter from "./kitchen";
import reportingRouter from "./reporting";
import selfOrderRouter from "./self-order";
import waitersRouter from "./waiters";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(categoriesRouter);
router.use(productsRouter);
router.use(paymentMethodsRouter);
router.use(floorsRouter);
router.use(customersRouter);
router.use(posConfigRouter);
router.use(sessionsRouter);
router.use(ordersRouter);
router.use(paymentsRouter);
router.use(kitchenRouter);
router.use(reportingRouter);
router.use(selfOrderRouter);
router.use(waitersRouter);

export default router;
