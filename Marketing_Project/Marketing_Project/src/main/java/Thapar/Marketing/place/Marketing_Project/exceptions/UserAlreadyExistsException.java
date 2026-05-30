package Thapar.Marketing.place.Marketing_Project.exceptions;

public class UserAlreadyExistsException extends RuntimeException{
    public UserAlreadyExistsException(String name){
        super(name);
    }
}
