// docs:start:token_types_all
use dep::aztec::prelude::{NoteHeader, NoteInterface, PrivateContext};
use dep::aztec::{
    note::{note_getter_options::PropertySelector, utils::compute_note_hash_for_consumption},
    hash::{compute_secret_hash, pedersen_hash}
};

global TRANSPARENT_NOTE_LEN: Field = 3;

// Transparent note represents a note that is created in the clear (public execution),
// but can only be spent by those that know the preimage of the "secret_hash"
#[aztec(note)]
struct TransparentNote {
    amount: Field,
    block_number: Field,
    secret_hash: Field,
    // the secret is just here for ease of use and won't be (de)serialized
    secret: Field,
}

struct TransparentNoteProperties {
    amount: PropertySelector,
    block_number: PropertySelector,
    secret_hash: PropertySelector,
}

impl NoteInterface<TRANSPARENT_NOTE_LEN> for TransparentNote {
    fn serialize_content(self) -> [Field; TRANSPARENT_NOTE_LEN] {
        [self.amount, self.block_number, self.secret_hash]
    }

    fn deserialize_content(serialized_note: [Field; TRANSPARENT_NOTE_LEN]) -> Self {
        TransparentNote::new(serialized_note[0], serialized_note[1], serialized_note[2])
    }

    fn compute_note_content_hash(self) -> Field {
        // TODO(#1205) Should use a non-zero generator index.
        pedersen_hash(self.serialize_content(), 0)
    }

    fn compute_nullifier(self, _context: &mut PrivateContext) -> Field {
        self.compute_nullifier_without_context()
    }

    fn compute_nullifier_without_context(self) -> Field {
        let siloed_note_hash = compute_note_hash_for_consumption(self);
        // TODO(#1205) Should use a non-zero generator index.
        pedersen_hash([self.secret, siloed_note_hash],0)
    }

    fn broadcast(self, context: &mut PrivateContext, slot: Field) {
        assert(false, "TransparentNote does not support broadcast");
    }
}

impl TransparentNote {

    // CONSTRUCTORS

    pub fn new(amount: Field, block_number: Field, secret_hash: Field) -> Self {
        assert(amount != 0, "Amount must be positive");
        TransparentNote { amount, block_number, secret_hash, secret: 0, header: NoteHeader::empty() }
    }

    // new oracle call primitive
    // get me the secret corresponding to this hash
    pub fn new_from_secret(amount: Field, block_number: Field, secret: Field) -> Self {
        assert(amount != 0, "Amount must be positive");
        TransparentNote { amount, block_number, secret_hash: compute_secret_hash(secret), secret, header: NoteHeader::empty() }
    }

    // CUSTOM FUNCTIONS FOR THIS NOTE TYPE

    pub fn knows_secret(self, secret: Field) {
        let hash = compute_secret_hash(secret);
        assert(self.secret_hash == hash);
    }

    // Custom serialization forces us to manually create the metadata struct and its getter
    pub fn properties() -> TransparentNoteProperties {
        TransparentNoteProperties {
            amount: PropertySelector { index: 0, offset: 0, length: 32 },
            block_number: PropertySelector { index: 1, offset: 0, length: 32 },
            secret_hash: PropertySelector { index: 2, offset: 0, length: 32 }
        }
    }
}
// docs:end:token_types_all