import "@stdlib/deploy";

// ─── Messages entrants ───────────────────────────────────────────────────────

// Envoye par userA ou userB pour deposer leur part
message Fund {}

// Envoye par userA ou userB pour confirmer que le date a eu lieu
message ConfirmRelease {}

// Envoye par n'importe quel participant pour declencher le remboursement
message Refund {}


// ─── Contrat principal ───────────────────────────────────────────────────────

contract DateEscrow with Deployable {

    // Adresses des deux participants, fixees au deploiement
    userA: Address;
    userB: Address;

    // Montant que chaque participant doit deposer (en nanoTON)
    amountPerUser: Int as coins;

    // Est-ce que chaque participant a depose sa part ?
    fundedA: Bool = false;
    fundedB: Bool = false;

    // Est-ce que chaque participant a confirme que le date a eu lieu ?
    confirmA: Bool = false;
    confirmB: Bool = false;

    // Flags d'etat final — un seul peut etre true a la fois
    released: Bool = false;
    refunded: Bool = false;

    // ─── Initialisation ──────────────────────────────────────────────────────
    init(userA: Address, userB: Address, amountPerUser: Int) {
        self.userA = userA;
        self.userB = userB;
        self.amountPerUser = amountPerUser;
    }

    // ─── Depot ───────────────────────────────────────────────────────────────
    receive(msg: Fund) {
        require(!self.released, "Deja libere");
        require(!self.refunded, "Deja rembourse");

        let who = sender();

        if (who == self.userA) {
            require(!self.fundedA, "UserA a deja depose");
            require(context().value >= self.amountPerUser, "Montant insuffisant");
            self.fundedA = true;
            return;
        }

        if (who == self.userB) {
            require(!self.fundedB, "UserB a deja depose");
            require(context().value >= self.amountPerUser, "Montant insuffisant");
            self.fundedB = true;
            return;
        }

        throw(401);
    }

    // ─── Confirmation du date ─────────────────────────────────────────────────
    receive(msg: ConfirmRelease) {
        require(self.fundedA && self.fundedB, "Pas encore finance");
        require(!self.released, "Deja libere");
        require(!self.refunded, "Deja rembourse");

        let who = sender();

        if (who == self.userA) {
            self.confirmA = true;
            return;
        }

        if (who == self.userB) {
            self.confirmB = true;
            return;
        }

        throw(401);
    }

    // ─── Liberation des fonds ─────────────────────────────────────────────────
    receive("release") {
        require(self.fundedA && self.fundedB, "Pas encore finance");
        require(self.confirmA && self.confirmB, "Les deux doivent confirmer");
        require(!self.released, "Deja libere");
        require(!self.refunded, "Deja rembourse");

        self.released = true;

        let total = myBalance() - ton("0.05");

        send(SendParameters{
            to: self.userA,
            value: total / 2,
            bounce: false
        });

        send(SendParameters{
            to: self.userB,
            value: total / 2,
            bounce: false
        });
    }

    // ─── Remboursement ────────────────────────────────────────────────────────
    // Callable par n'importe quel participant, sans condition de temps
    receive(msg: Refund) {
        require(!self.released, "Deja libere");
        require(!self.refunded, "Deja rembourse");

        let who = sender();
        require(who == self.userA || who == self.userB, "Non autorise");

        self.refunded = true;

        if (self.fundedA) {
            send(SendParameters{
                to: self.userA,
                value: self.amountPerUser,
                bounce: false
            });
        }

        if (self.fundedB) {
            send(SendParameters{
                to: self.userB,
                value: self.amountPerUser,
                bounce: false
            });
        }
    }

    // ─── Getters (lecture seule) ──────────────────────────────────────────────

    get fun state(): String {
        if (self.refunded) { return "REFUNDED"; }
        if (self.released) { return "RELEASED"; }
        if (self.fundedA && self.fundedB) { return "FUNDED"; }
        if (self.fundedA || self.fundedB) { return "PARTIAL"; }
        return "OPEN";
    }

    get fun participantsFunded(): Int {
        let count = 0;
        if (self.fundedA) { count = count + 1; }
        if (self.fundedB) { count = count + 1; }
        return count;
    }

    get fun confirmationsCount(): Int {
        let count = 0;
        if (self.confirmA) { count = count + 1; }
        if (self.confirmB) { count = count + 1; }
        return count;
    }
}
