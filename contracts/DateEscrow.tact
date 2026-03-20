import "@stdlib/deploy";

// ─── Messages entrants ───────────────────────────────────────────────────────

// Envoyé par userA ou userB pour déposer leur part
message Fund {}

// Envoyé par userA ou userB pour confirmer que le date a eu lieu
message ConfirmRelease {}

// Envoyé par n'importe qui après expiration de la deadline
// pour déclencher le remboursement
message Refund {}


// ─── Contrat principal ───────────────────────────────────────────────────────

contract DateEscrow with Deployable {

    // Adresses des deux participants, fixées au déploiement
    userA: Address;
    userB: Address;

    // Montant que chaque participant doit déposer (en nanoTON)
    amountPerUser: Int as coins;

    // Timestamp Unix après lequel le refund devient possible
    // si le date n'a pas été confirmé
    deadline: Int as uint64;

    // Est-ce que chaque participant a déposé sa part ? => Met en place une deadline, Stocke l'argent
    fundedA: Bool = false;
    fundedB: Bool = false;

    //Code => Requete  true => RENVOIE L ARGENT
    // Est-ce que chaque participant a confirmé que le date a eu lieu ?
    confirmA: Bool = false;
    confirmB: Bool = false;


    // Flags d'état final — un seul peut être true à la fois
    released: Bool = false;
    refunded: Bool = false;

    // ─── Initialisation ──────────────────────────────────────────────────────
    // Appelé une seule fois au déploiement du contrat
    // Le backend crée un contrat par "deal" accepté par les deux users
    init(userA: Address, userB: Address, amountPerUser: Int, deadline: Int) {
        self.userA = userA;
        self.userB = userB;
        self.amountPerUser = amountPerUser;
        self.deadline = deadline;
    }

    // ─── Dépôt ───────────────────────────────────────────────────────────────
    // Chaque participant envoie un message Fund avec exactement amountPerUser
    // Le contrat identifie qui envoie via sender()
    receive(msg: Fund) {
        // On bloque si le contrat est déjà terminé
        require(!self.released, "Deja libere");
        require(!self.refunded, "Deja rembourse");
        require(now() <= self.deadline, "Deadline depassee");

        let who = sender();

        if (who == self.userA) {
            require(!self.fundedA, "UserA a deja depose");
            // Vérifie que le montant envoyé est suffisant
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

        // Si l'expéditeur n'est ni userA ni userB → rejet
        throw(401);
    }

    // ─── Confirmation du date ─────────────────────────────────────────────────
    // Chaque participant confirme que le date a bien eu lieu
    // (déclenché par ton app après validation du code croisé)
    receive(msg: ConfirmRelease) {
        require(self.fundedA && self.fundedB, "Pas encore finance");
        require(!self.released, "Deja libere");
        require(!self.refunded, "Deja rembourse");

        let who = sender();

        if (who == self.userA) {
            self.confirmA = true;
            return; // Help
        }

        if (who == self.userB) {
            self.confirmB = true;
            return;
        }

        throw(401);
    }

    // ─── Libération des fonds ─────────────────────────────────────────────────
    // Appelé une fois que les DEUX ont confirmé via ConfirmRelease
    // Renvoie la moitié du solde à chaque participant
    // (ils utilisent cet argent pour payer l'activité)
    receive("release") {
        require(self.fundedA && self.fundedB, "Pas encore finance");
        require(self.confirmA && self.confirmB, "Les deux doivent confirmer");
        require(!self.released, "Deja libere");
        require(!self.refunded, "Deja rembourse");

        self.released = true;

        // On garde 0.05 TON pour couvrir les frais de transaction
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
    // Disponible uniquement après expiration de la deadline
    // Rembourse chaque participant du montant qu'il a déposé
    receive(msg: Refund) {
        require(!self.released, "Deja libere");
        require(!self.refunded, "Deja rembourse");
        require(now() > self.deadline, "Deadline pas encore atteinte");

        self.refunded = true;

        // On ne rembourse que les participants qui ont effectivement déposé
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

    // Retourne l'état lisible du contrat
    // Utile pour ton backend pour afficher l'état du date
    get fun state(): String {
        if (self.refunded) { return "REFUNDED"; }
        if (self.released) { return "RELEASED"; }
        if (self.fundedA && self.fundedB) { return "FUNDED"; }
        if (self.fundedA || self.fundedB) { return "PARTIAL"; }
        return "OPEN";
    }

    // Retourne combien de participants ont déposé (0, 1 ou 2)
    get fun participantsFunded(): Int {
        let count = 0;
        if (self.fundedA) { count = count + 1; }
        if (self.fundedB) { count = count + 1; }
        return count;
    }

    // Retourne combien de participants ont confirmé le date (0, 1 ou 2)
    get fun confirmationsCount(): Int {
        let count = 0;
        if (self.confirmA) { count = count + 1; }
        if (self.confirmB) { count = count + 1; }
        return count;
    }
}
