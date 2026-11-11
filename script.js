import { deleteApp, initializeApp } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js";
import {
    createUserWithEmailAndPassword,
    deleteUser,
    getAuth,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js";
import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDoc,
    getFirestore,
    onSnapshot,
    serverTimestamp,
    setDoc,
    updateDoc
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyC186QRDYHRZOk1eKR3KkbDdNKb2uKmIzs",
    authDomain: "prompt-express-58ba5.firebaseapp.com",
    projectId: "prompt-express-58ba5",
    storageBucket: "prompt-express-58ba5.firebasestorage.app",
    messagingSenderId: "269456911615",
    appId: "1:269456911615:web:b59200905039b469fc70ca",
    measurementId: "G-EJDH1MD33D"
};

const loginPanel = document.querySelector("#login-panel");
const loginForm = document.querySelector("#login-form");
const loginEmail = document.querySelector("#login-email");
const loginPassword = document.querySelector("#login-password");
const loginButton = document.querySelector("#login-button");
const loginMezssage = document.querySelector("#login-message");
const workspace = document.querySelector("#workspace");
const accountLabel = document.querySelector("#account-label");
const logoutButton = document.querySelector("#logout-button");
const customerForm = document.querySelector("#customer-form");
const customerNameInput = document.querySelector("#customer-name");
const customerPhoneInput = document.querySelector("#customer-phone");
const customerContactInput = document.querySelector("#customer-contact");
const customerAddressInput = document.querySelector("#customer-address");
const customerFormTitle = document.querySelector("#customer-form-title");
const saveCustomerButton = document.querySelector("#save-customer");
const cancelCustomerEditButton = document.querySelector("#cancel-customer-edit");
const searchInput = document.querySelector("#customer-search");
const customerList = document.querySelector("#customer-list");
const customerCount = document.querySelector("#customer-count");
const customerMessage = document.querySelector("#customer-message");
const adminPanel = document.querySelector("#admin-panel");
const employeeForm = document.querySelector("#employee-form");
const employeeEmail = document.querySelector("#employee-email");
const employeePassword = document.querySelector("#employee-password");
const createEmployeeButton = document.querySelector("#create-employee");
const adminMessage = document.querySelector("#admin-message");
const employeeList = document.querySelector("#employee-list");

let auth;
let database;
let customers = [];
let currentRole = "";
let editingCustomerId = null;
let stopWatchingCustomers;
let stopWatchingEmployees;

function showMessage(element, message, kind = "info") {
    element.textContent = message;
    element.dataset.kind = kind;
}

function renderCustomers() {
    const searchTerm = searchInput.value.trim().toLocaleLowerCase("th");
    const filteredCustomers = customers.filter((customer) =>
        [customer.name, customer.phone, customer.customerName, customer.address]
            .some((value) => typeof value === "string" && value.toLocaleLowerCase("th").includes(searchTerm))
    );

    customerCount.textContent = `${customers.length} รายชื่อ`;
    customerList.replaceChildren();

    if (filteredCustomers.length === 0) {
        const emptyItem = document.createElement("li");
        emptyItem.className = "list-placeholder";
        emptyItem.textContent = customers.length === 0
            ? "ยังไม่มีรายชื่อลูกค้า เพิ่มรายชื่อแรกของทีมได้เลย"
            : "ไม่พบชื่อลูกค้าที่ค้นหา";
        customerList.append(emptyItem);
        return;
    }

    for (const customer of filteredCustomers) {
        const item = document.createElement("li");
        item.className = "customer-item";

        const avatar = document.createElement("span");
        avatar.className = "customer-avatar";
        avatar.setAttribute("aria-hidden", "true");
        avatar.textContent = customer.name.trim().charAt(0).toLocaleUpperCase("th");

        const details = document.createElement("div");
        details.className = "customer-info";

        const name = document.createElement("span");
        name.className = "customer-name";
        name.textContent = customer.name;

        const contact = document.createElement("span");
        contact.className = "customer-detail";
        contact.textContent = `ผู้ติดต่อ: ${customer.customerName || "-"} · โทร: ${customer.phone || "-"}`;

        const address = document.createElement("span");
        address.className = "customer-detail";
        address.textContent = `ที่อยู่: ${customer.address || "-"}`;
        details.append(name, contact, address);

        const actions = document.createElement("div");
        actions.className = "customer-actions";

        const editButton = document.createElement("button");
        editButton.className = "role-button";
        editButton.type = "button";
        editButton.dataset.customerAction = "edit";
        editButton.dataset.customerId = customer.id;
        editButton.textContent = "แก้ไข";
        editButton.setAttribute("aria-label", `แก้ไขข้อมูล ${customer.name}`);
        actions.append(editButton);

        if (currentRole === "admin") {
            const deleteButton = document.createElement("button");
            deleteButton.className = "danger-button";
            deleteButton.type = "button";
            deleteButton.dataset.customerAction = "delete";
            deleteButton.dataset.customerId = customer.id;
            deleteButton.textContent = "ลบ";
            deleteButton.setAttribute("aria-label", `ลบข้อมูล ${customer.name}`);
            actions.append(deleteButton);
        }

        item.append(avatar, details, actions);
        customerList.append(item);
    }
}

function resetCustomerForm() {
    customerForm.reset();
    for (const input of [customerNameInput, customerPhoneInput, customerContactInput, customerAddressInput]) {
        input.setCustomValidity("");
    }
    editingCustomerId = null;
    customerFormTitle.textContent = "เพิ่มข้อมูลร้าน";
    saveCustomerButton.textContent = "เพิ่มข้อมูลร้าน";
    cancelCustomerEditButton.hidden = true;
}

function startCustomerEdit(customer) {
    editingCustomerId = customer.id;
    customerNameInput.value = customer.name;
    customerPhoneInput.value = customer.phone || "";
    customerContactInput.value = customer.customerName || "";
    customerAddressInput.value = customer.address || "";
    customerFormTitle.textContent = "แก้ไขข้อมูลร้าน";
    saveCustomerButton.textContent = "บันทึกการแก้ไข";
    cancelCustomerEditButton.hidden = false;
    customerNameInput.focus();
    customerForm.scrollIntoView({ behavior: "smooth", block: "center" });
}

function renderEmployees(snapshot, currentUserId) {
    employeeList.replaceChildren();
    const employees = snapshot.docs
        .map((employeeDocument) => ({
            id: employeeDocument.id,
            ...employeeDocument.data()
        }))
        .sort((first, second) => String(first.email).localeCompare(String(second.email)));
    const adminCount = employees.filter((employee) => employee.role === "admin").length;

    if (employees.length === 0) {
        const emptyItem = document.createElement("li");
        emptyItem.className = "list-placeholder";
        emptyItem.textContent = "ยังไม่มีบัญชีพนักงาน";
        employeeList.append(emptyItem);
        return;
    }

    for (const employee of employees) {
        const item = document.createElement("li");
        item.className = "employee-row";

        const details = document.createElement("div");
        const email = document.createElement("span");
        email.className = "employee-email";
        email.textContent = employee.email || "ไม่มีอีเมล";
        const role = document.createElement("span");
        role.className = "employee-role";
        role.textContent = employee.role === "admin" ? "ผู้ดูแลระบบ" : "พนักงาน";
        details.append(email, role);

        const roleButton = document.createElement("button");
        roleButton.className = "role-button";
        roleButton.type = "button";
        roleButton.dataset.userId = employee.id;
        roleButton.dataset.role = employee.role === "admin" ? "employee" : "admin";
        roleButton.textContent = employee.role === "admin" ? "ลดสิทธิ์" : "ตั้งเป็นแอดมิน";
        roleButton.disabled = employee.id === currentUserId
            || (employee.role === "admin" && adminCount === 1);
        roleButton.setAttribute(
            "aria-label",
            employee.id === currentUserId
                ? "ไม่สามารถเปลี่ยนสิทธิ์บัญชีที่กำลังใช้งาน"
                : employee.role === "admin" && adminCount === 1
                    ? "ต้องมีแอดมินอย่างน้อยหนึ่งบัญชี"
                : `${roleButton.textContent}: ${employee.email || "บัญชีนี้"}`
        );

        item.append(details, roleButton);
        employeeList.append(item);
    }
}

function stopWorkspaceListeners() {
    if (stopWatchingCustomers) {
        stopWatchingCustomers();
        stopWatchingCustomers = undefined;
    }
    if (stopWatchingEmployees) {
        stopWatchingEmployees();
        stopWatchingEmployees = undefined;
    }
}

function startWorkspaceListeners(user, role) {
    stopWorkspaceListeners();
    searchInput.value = "";
    customerCount.textContent = "กำลังโหลด...";
    customerList.replaceChildren();
    const loadingItem = document.createElement("li");
    loadingItem.className = "list-placeholder";
    loadingItem.textContent = "กำลังโหลดรายชื่อลูกค้า...";
    customerList.append(loadingItem);

    stopWatchingCustomers = onSnapshot(
        collection(database, "customers"),
        (snapshot) => {
            customers = snapshot.docs
                .map((customerDocument) => ({
                    id: customerDocument.id,
                    ...customerDocument.data()
                }))
                .filter((customer) => typeof customer.name === "string")
                .sort((first, second) => first.name.localeCompare(second.name, "th"));
            renderCustomers();
            showMessage(customerMessage, "");
        },
        (error) => {
            console.error("Unable to load customers from Firestore.", error);
            customerCount.textContent = "โหลดข้อมูลไม่สำเร็จ";
            customerList.replaceChildren();
            const errorItem = document.createElement("li");
            errorItem.className = "list-placeholder";
            errorItem.textContent = "โหลดข้อมูลไม่ได้ กรุณาตรวจสอบการเชื่อมต่อและ Firestore Rules";
            customerList.append(errorItem);
            showMessage(customerMessage, "โหลดข้อมูลไม่สำเร็จ กรุณาตรวจสอบสิทธิ์ฐานข้อมูล", "error");
        }
    );

    if (role === "admin") {
        stopWatchingEmployees = onSnapshot(
            collection(database, "users"),
            (snapshot) => renderEmployees(snapshot, user.uid),
            (error) => {
                console.error("Unable to load employee accounts.", error);
                employeeList.replaceChildren();
                const errorItem = document.createElement("li");
                errorItem.className = "list-placeholder";
                errorItem.textContent = "โหลดบัญชีไม่ได้ กรุณาตรวจสอบ Firestore Rules";
                employeeList.append(errorItem);
                showMessage(adminMessage, "โหลดบัญชีพนักงานไม่สำเร็จ", "error");
            }
        );
    }
}

if (Object.values(firebaseConfig).some((value) => !value.trim() || value.startsWith("YOUR_"))) {
    loginButton.disabled = true;
    showMessage(loginMessage, "กรุณาตั้งค่า Firebase config ใน script.js ก่อนใช้งาน", "error");
} else {
    const app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    database = getFirestore(app);

    loginForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        loginButton.disabled = true;
        showMessage(loginMessage, "กำลังเข้าสู่ระบบ...");

        try {
            await signInWithEmailAndPassword(auth, loginEmail.value.trim(), loginPassword.value);
            loginForm.reset();
            showMessage(loginMessage, "");
        } catch (error) {
            console.error("Unable to sign in.", error);
            showMessage(loginMessage, "เข้าสู่ระบบไม่สำเร็จ กรุณาตรวจสอบอีเมลและรหัสผ่าน", "error");
        } finally {
            loginButton.disabled = false;
        }
    });

    logoutButton.addEventListener("click", async () => {
        try {
            await signOut(auth);
        } catch (error) {
            console.error("Unable to sign out.", error);
            showMessage(customerMessage, "ออกจากระบบไม่สำเร็จ กรุณาลองอีกครั้ง", "error");
        }
    });

    onAuthStateChanged(auth, async (user) => {
        stopWorkspaceListeners();
        customers = [];
        currentRole = "";
        resetCustomerForm();
        workspace.hidden = true;
        loginPanel.hidden = !user;

        if (!user) {
            loginPanel.hidden = false;
            adminPanel.hidden = true;
            return;
        }

        try {
            const userProfile = await getDoc(doc(database, "users", user.uid));
            const role = userProfile.data()?.role;

            if (!userProfile.exists() || !["admin", "employee"].includes(role)) {
                showMessage(loginMessage, "บัญชีนี้ยังไม่ได้รับสิทธิ์เข้าใช้งาน กรุณาติดต่อแอดมิน", "error");
                await signOut(auth);
                return;
            }

            accountLabel.textContent = `${user.email || ""} · ${role === "admin" ? "แอดมิน" : "พนักงาน"}`;
            currentRole = role;
            adminPanel.hidden = role !== "admin";
            workspace.hidden = false;
            loginPanel.hidden = true;
            startWorkspaceListeners(user, role);
        } catch (error) {
            console.error("Unable to verify user access.", error);
            showMessage(loginMessage, "ตรวจสอบสิทธิ์ไม่สำเร็จ กรุณาติดต่อผู้ดูแลระบบ", "error");
            await signOut(auth);
        }
    });

    customerForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const customerData = {
            name: customerNameInput.value.trim(),
            phone: customerPhoneInput.value.trim(),
            customerName: customerContactInput.value.trim(),
            address: customerAddressInput.value.trim()
        };
        const emptyField = [
            [customerNameInput, customerData.name, "กรุณากรอกชื่อร้าน"],
            [customerPhoneInput, customerData.phone, "กรุณากรอกเบอร์โทรศัพท์"],
            [customerContactInput, customerData.customerName, "กรุณากรอกชื่อลูกค้าหรือผู้ติดต่อ"],
            [customerAddressInput, customerData.address, "กรุณากรอกที่อยู่ลูกค้า"]
        ].find(([, value]) => !value);

        if (emptyField) {
            const [input, , message] = emptyField;
            input.setCustomValidity(message);
            input.reportValidity();
            return;
        }
        for (const input of [customerNameInput, customerPhoneInput, customerContactInput, customerAddressInput]) {
            input.setCustomValidity("");
        }

        saveCustomerButton.disabled = true;
        showMessage(customerMessage, "กำลังบันทึก...");

        try {
            if (editingCustomerId) {
                await updateDoc(doc(database, "customers", editingCustomerId), customerData);
                resetCustomerForm();
                showMessage(customerMessage, "แก้ไขข้อมูลร้านเรียบร้อยแล้ว");
            } else {
                await addDoc(collection(database, "customers"), {
                    ...customerData,
                    createdAt: serverTimestamp(),
                    createdBy: auth.currentUser.uid
                });
                resetCustomerForm();
                customerNameInput.focus();
                showMessage(customerMessage, "เพิ่มข้อมูลร้านเรียบร้อยแล้ว");
            }
        } catch (error) {
            console.error("Unable to save customer changes.", error);
            showMessage(customerMessage, "บันทึกไม่สำเร็จ กรุณาตรวจสอบสิทธิ์ฐานข้อมูลแล้วลองอีกครั้ง", "error");
        } finally {
            saveCustomerButton.disabled = false;
        }
    });

    customerForm.addEventListener("input", (event) => {
        event.target.setCustomValidity("");
    });
    cancelCustomerEditButton.addEventListener("click", resetCustomerForm);
    searchInput.addEventListener("input", renderCustomers);

    customerList.addEventListener("click", async (event) => {
        const button = event.target.closest("button[data-customer-action]");
        if (!button) {
            return;
        }

        const customer = customers.find((entry) => entry.id === button.dataset.customerId);
        if (!customer) {
            return;
        }

        if (button.dataset.customerAction === "edit") {
            startCustomerEdit(customer);
            return;
        }

        if (button.dataset.customerAction !== "delete" || currentRole !== "admin") {
            return;
        }

        if (!window.confirm(`ยืนยันการลบข้อมูลร้าน "${customer.name}" หรือไม่?`)) {
            return;
        }

        button.disabled = true;
        try {
            await deleteDoc(doc(database, "customers", customer.id));
            showMessage(customerMessage, "ลบข้อมูลร้านเรียบร้อยแล้ว");
        } catch (error) {
            console.error("Unable to delete customer.", error);
            showMessage(customerMessage, "ลบข้อมูลไม่สำเร็จ กรุณาตรวจสอบสิทธิ์แอดมินและ Firestore Rules", "error");
        } finally {
            button.disabled = false;
        }
    });

    employeeForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const email = employeeEmail.value.trim();
        const password = employeePassword.value;
        createEmployeeButton.disabled = true;
        showMessage(adminMessage, "กำลังสร้างบัญชี...");

        let provisioningApp;
        let createdUser;
        let profileCreated = false;
        try {
            provisioningApp = initializeApp(firebaseConfig, `employee-setup-${Date.now()}`);
            const provisioningAuth = getAuth(provisioningApp);
            const credentials = await createUserWithEmailAndPassword(provisioningAuth, email, password);
            createdUser = credentials.user;
            await setDoc(doc(database, "users", credentials.user.uid), {
                email,
                role: "employee",
                createdAt: serverTimestamp()
            });
            profileCreated = true;
            employeeForm.reset();
            showMessage(adminMessage, "สร้างบัญชีพนักงานเรียบร้อยแล้ว");
        } catch (error) {
            console.error("Unable to create employee account.", error);
            let message;
            if (createdUser && !profileCreated) {
                try {
                    await deleteUser(createdUser);
                    message = "สร้างสิทธิ์บัญชีไม่สำเร็จ ระบบยกเลิกบัญชีที่สร้างไว้แล้ว กรุณาตรวจสอบ Firestore Rules";
                } catch (cleanupError) {
                    console.error("Unable to remove incomplete employee account.", cleanupError);
                    message = "สร้างบัญชีไม่สมบูรณ์ กรุณาลบบัญชีนี้จาก Firebase Authentication ก่อนลองใหม่";
                }
            } else {
                message = error.code === "auth/email-already-in-use"
                    ? "อีเมลนี้มีบัญชีอยู่แล้ว"
                    : error.code === "auth/weak-password"
                        ? "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร"
                        : "สร้างบัญชีไม่สำเร็จ กรุณาตรวจสอบการตั้งค่า Firebase และสิทธิ์";
            }
            showMessage(adminMessage, message, "error");
        } finally {
            if (provisioningApp) {
                try {
                    await deleteApp(provisioningApp);
                } catch (error) {
                    console.error("Unable to clean up employee setup app.", error);
                }
            }
            createEmployeeButton.disabled = false;
        }
    });

    employeeList.addEventListener("click", async (event) => {
        const button = event.target.closest("button[data-user-id]");
        if (!button || button.disabled) {
            return;
        }

        button.disabled = true;
        try {
            await updateDoc(doc(database, "users", button.dataset.userId), {
                role: button.dataset.role
            });
            showMessage(adminMessage, "ปรับสิทธิ์บัญชีเรียบร้อยแล้ว");
        } catch (error) {
            console.error("Unable to update employee role.", error);
            showMessage(adminMessage, "ปรับสิทธิ์ไม่สำเร็จ กรุณาลองอีกครั้ง", "error");
        } finally {
            button.disabled = false;
        }
    });
}
